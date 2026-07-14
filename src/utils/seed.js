require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Settings = require("../models/Settings");

async function seed() {
  await connectDB();

  const existingAdmin = await User.findOne({ username: "admin" });
  if (!existingAdmin) {
    await User.create({
      name: "Admin",
      username: "admin",
      email: "admin@saraspos.com",
      password: "Admin@123",
      businessName: "Saras POS Demo Shop",
      country: "India",
      agreedToTerms: true,
      role: "admin",
    });
    console.log(
      "Default admin created -> username: admin | password: Admin@123",
    );
  } else {
    console.log("Admin user already exists, skipping.");
  }

  const existingSettings = await Settings.findOne();
  if (!existingSettings) {
    await Settings.create({});
    console.log("Default settings created.");
  } else {
    console.log("Settings already exist, skipping.");
  }

  await mongoose.connection.close();
  console.log("Seeding complete.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
