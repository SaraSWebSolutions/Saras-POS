const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected`);
  } catch (err) {
    console.error(`MongoDB Connection Error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;


// const mongoose = require("mongoose");

// const connectDB = async () => {
//   try {
//     await mongoose.connect(
//       process.env.MONGO_URI
//     );

//     console.log(
//       "MongoDB Connected Successfully"
//     );
//   } catch (err) {
//     console.log("MongoDB Connection Failed", err);

//     process.exit(1);
//   }
// };

// module.exports = connectDB;