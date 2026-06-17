// utils/testPassword.js

const bcrypt = require("bcryptjs");

const hash =
  "$2a$12$ksa5jcLkQLoXddPpe3fMPe6LhWgslmGrLNIJyWynI2L3zKVFlH64O";

bcrypt.compare("Admin@123", hash)
  .then(result => console.log(result))
  .catch(console.error);