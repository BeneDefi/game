export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const crypto = require("crypto");
    const BOT_TOKEN = process.env.BOT_TOKEN; // Ensure this is set in Vercel

    function checkTelegramAuth(data) {
        const secret = crypto.createHash("sha256").update(BOT_TOKEN).digest();
        const checkString = Object.keys(data)
            .filter((key) => key !== "hash")
            .sort()
            .map((key) => `${key}=${data[key]}`)
            .join("\n");

        const hmac = crypto.createHmac("sha256", secret).update(checkString).digest("hex");
        return hmac === data.hash;
    }

    const { user, initData } = req.body;

    if (!user || !initData) {
        return res.status(400).json({ error: "Missing required data" });
    }

    // Parse initData to extract authentication data
    const urlParams = new URLSearchParams(initData);
    const authData = Object.fromEntries(urlParams.entries());

    if (!checkTelegramAuth(authData)) {
        return res.status(403).json({ error: "Unauthorized request" });
    }

    // Example: Log or store user data
    console.log("Authenticated user:", user);

    res.status(200).json({ message: "User data received", user });
}
