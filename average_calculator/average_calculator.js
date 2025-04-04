const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = 3000;
const WINDOW_SIZE = 10;
let numberWindow = [];

const AUTH_TOKEN = process.env.AUTH_TOKEN;

const fetchNumbers = async (type) => {
    const base = "http://20.244.56.144/evaluation-service";
    const endpoints = {
        p: `${base}/primes`,
        f: `${base}/fibo`,
        e: `${base}/even`,
        r: `${base}/rand`
    };

    const url = endpoints[type];
    if (!url) return [];

    try {
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${AUTH_TOKEN}`
            },
            timeout: 1000
        });

        return response.data.numbers || [];
    } catch (error) {
        console.error(`Error fetching ${type} numbers:`, error.message);
        return [];
    }
};

// API endpoint
app.get("/numbers/:numberid", async (req, res) => {
    const { numberid } = req.params;
    if (!['p', 'f', 'e', 'r'].includes(numberid)) {
        return res.status(400).json({ error: "Invalid number ID" });
    }

    const previousState = [...numberWindow];
    const newNumbers = await fetchNumbers(numberid);

    newNumbers.forEach(num => {
        if (!numberWindow.includes(num)) {
            if (numberWindow.length >= WINDOW_SIZE) numberWindow.shift();
            numberWindow.push(num);
        }
    });

    const average = numberWindow.length
        ? (numberWindow.reduce((sum, num) => sum + num, 0) / numberWindow.length).toFixed(2)
        : 0;

    res.json({
        windowPrevState: previousState,
        windowCurrState: numberWindow,
        numbers: newNumbers,
        average: parseFloat(average)
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
