// Rencana: Decentralized Locker System
/* List of methods:
getItem
trade
setItem (admin mungkin)
deleteItem (tambahan)
checkInventory
HistoryTransaction(user, trades)


Item(Id, name, quantity)
ListofItems(id, name)
User(id, name, inventory, history)
dll
List of pembelajaran:
query -> temporary aja, call function basically ambil" data
update -> buat ngubah data, sifatnya permanen kalo ada fungsi set
          di query gk akan ke update (temporer). Disini bakal ke update permanen

*/
import {
    query,
    update,
    text,
    Record,
    StableBTreeMap,
    Principal,
    nat64,
    nat8,
    Canister,
    Err,
    Ok,
    Result,
    Vec,
    Void,
    bool,
    empty,
    ic,
    Opt,
    None,
    Some
  } from "azle";
import { v4 as uuidv4 } from "uuid";


const Renter = Record({
  id: Principal,
  userRenterId: Principal,
  duration: nat64,
  lockerId: Principal
})

const RenterPayload = Record({
  duration: nat64,
  lockerId: Principal
})
const Locker = Record({
  id: Principal,
  number: text,
  availability: bool,
  renterId: Opt(Principal)
})
const LockerPayload = Record({
  number: text
})
const User = Record({
  id: Principal,
  name: text,
  createdAt: nat64
})

const UserPayload = Record({
  name: text
})

type Renter = typeof Renter.tsType;
type RenterPayload = typeof RenterPayload.tsType;
type User = typeof User.tsType;
type UserPayload = typeof UserPayload.tsType;
type Locker = typeof Locker.tsType;
type LockerPayload = typeof LockerPayload.tsType;
let users = StableBTreeMap<Principal, User>(0);
let lockers = StableBTreeMap<Principal, Locker>(1);
let rents = StableBTreeMap<Principal, Renter>(2);

export default Canister({
    createUser: update([UserPayload], Result(User, text), (payload) => {
      // Input validation
      if (!payload.name){
        return Err("Input invalid");
      }
      const id = generateId();
      const user: User = {
        id,
        name : payload.name,
        createdAt : ic.time()
      };
      users.insert(user.id, user);

      return Ok(user);
    }),

    getUsers: query([], Vec(User), () =>{
      return users.values();
    }),

    getUserById: query([Principal], Result(User, text), (userID) => {
      const userOpt = users.get(userID); 
      if ("None" in userOpt){
        return Err("User doesnt exist")
      }

      return Ok(userOpt.Some);
    }),

    getLockers: query([], Vec(Locker), () => {
      return lockers.values();
    }),
    getLockerById: query([Principal], Result(Locker, text), (lockerID) => {
      const lockerOpt = lockers.get(lockerID); 
      if ("None" in lockerOpt){
        return Err("Locker doesnt exist");
      }

      return Ok(lockerOpt.Some);
    }),

    getRenters: query([], Vec(Renter), () =>{
      return rents.values();
    }),
    getRenterById: query([Principal], Result(Renter, text), (renterID) => {
      const renterOpt = rents.get(renterID); 
      if ("None" in renterOpt){
        return Err("Renter doesnt exist");
      }

      return Ok(renterOpt.Some);
    }),
    addLocker: update([LockerPayload], Result(Locker, text), (payload) =>{
      // Validate inputs
      if (!payload.number){
        return Err("Input invalid");
      }



      let id = generateId();
      let existLockers = lockers.get(id);
      while(!("None" in existLockers)){
        id = generateId();
        existLockers = lockers.get(id);
      }
      const locker: Locker = {
        id,
        number: payload.number,
        availability: true,
        renterId: None
      }
      lockers.insert(locker.id, locker);
      return Ok(locker);
    }),

    rentLocker: update([Principal, RenterPayload], Result(Renter, text), (userId, payload) => {
      // Input validation
      if (!payload.duration || !payload.lockerId){
        return Err("Input invalid");
      }
      // Checking user and locker existance
      
      if (!userId){
        return Err("Invalid user");
      }


      if (!lockers.get(payload.lockerId)){
        return Err("Locker does not exist!");
      }

      // Checking if locker is valid and available
      const lockerOpt = lockers.get(payload.lockerId)
      // Validate locker existance
      if ("None" in lockerOpt){
        return Err("Locker doesn't exist");
      }
      const locker = lockerOpt.Some;
      // Validate locker availability
      if (!locker.availability){
        return Err("Locker is not available");
      }

      // Create Rent & since locker is available
      let rentId = generateRentId(userId);
      let existRents = rents.get(rentId);
      while(!("None" in existRents)){
        rentId = generateId();
        existRents = rents.get(rentId);
      }
      const renter: Renter ={
        id: rentId,
        userRenterId: userId,
        duration: payload.duration,
        lockerId: payload.lockerId
      }

      // Update Locker
      const usedLocker: Locker = {
        ...locker,
        availability: false,
        renterId: Some(payload.lockerId),
      }

      rents.insert(renter.id, renter);
      lockers.insert(payload.lockerId, usedLocker)
      return Ok(renter);

    }),

    evictLocker: update([Principal], Result(bool, text), (rentalID) => {
      // Validation of rented locker
      if (!rentalID){
        return Result.Err("Locker is still available");
      }

      // Checking if locker is unavailable and used by user
      const rentalOpt = rents.get(rentalID)
      if ("None" in rentalOpt){
        return Err("Locker is still available");
      }
      const rental = rentalOpt.Some;
      if (!rental){
        return Err("Locker rental was not valid");
      }
      // Getting locker information
      const lockerOpt = lockers.get(rental.lockerId);
      // Validate locker existance
      if ("None" in lockerOpt){
        return Err("Locker doesn't exist")
      }
      const locker = lockerOpt.Some;
    
      // Update locker
      const usedLocker: Locker = {
        ...locker,
        availability: true,
        renterId: None,
      }

      lockers.insert(locker.id, usedLocker);
      // Removing rental information, since locker has been released
      rents.remove(rentalID);
      return Result.Ok(true);
    })
});

function generateId(): Principal {
  const randomBytes = new Array(29)
      .fill(0)
      .map((_) => Math.floor(Math.random() * 256));

  return Principal.fromUint8Array(Uint8Array.from(randomBytes));
}
function generateRentId(userId: Principal): Principal {
  const timestampBytes = new Array(13).fill(0).map((_) => Number(ic.time()) % 256);
  const randomBytes = new Array(16)
      .fill(0)
      .map((_) => Math.floor(Math.random() * 256));
  const combinedBytes = [...timestampBytes, ...randomBytes];
  return Principal.fromUint8Array(Uint8Array.from(combinedBytes));
}

// function 

