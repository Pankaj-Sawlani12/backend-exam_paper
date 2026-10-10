const mongoose = require('mongoose');

const mongo_url = process.env.MONGO_CONN;

const connectDB = async () => {
    try {
        if (!mongo_url) {
            throw new Error('MONGO_CONN environment variable is missing');
        }

        if (mongoose.connection.readyState === 1) {
            return;
        }

        await mongoose.connect(mongo_url, {
            serverSelectionTimeoutMS: 10000
        });

        console.log('MongoDB Connected...');
    } catch (err) {
        console.error('MongoDB Connection Error:', err.message);
        throw err;
    }
};

module.exports = connectDB;

    // const mongoose = require('mongoose');

    // const mongo_url = process.env.MONGO_CONN;

    // mongoose.connect(mongo_url)
    // .then(()=> {
    //     console.log('MongoDB Connected...');
    // }).catch((err)=>{
    //     console.log('MongoDB Connection Error: ',err);
    // })