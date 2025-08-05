const express = require("express");
const cors = require('cors');
const path = require("path");
const bodyParser = require('body-parser');
const serverless = require('serverless-http');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const qs = require("querystring");
const crypto = require('crypto');
require('dotenv').config();
const FormData = require('form-data');
const supabaseUrl = 'https://vyfqtqvhonepjjwfqgfb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5ZnF0cXZob25lcGpqd2ZxZ2ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkyODM1MTksImV4cCI6MjA1NDg1OTUxOX0.CLOUrX54KDcBjCFGBfZbRpTDrv0ImMrFMca-22AwwZc';
const supabase = createClient(supabaseUrl, supabaseKey);






const BOT_TOKEN = "7600243365:AAGRYUmzJvxbkkNmYmW_ppmNvhvWLil3BzU";
const TELEGRAM_CHAT_ID = "-1002491731538";
const app = express();
app.use(express.json());
app.use(cors({
    origin: 'https://pacton-11.vercel.app',
    methods: ['GET', 'POST', 'OPTIONS'],  // Add OPTIONS
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept'],
    credentials: true
}));



// Handle Preflight Requests (OPTIONS)
app.options('*', (req, res) => {
    res.header("Access-Control-Allow-Origin", "https://pacton-11.vercel.app");  // Match origin
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.sendStatus(200);
});



app.get('/api/getTop20', async (req, res) => {
    try {
        const { data: topUsers, error } = await supabase
            .from('users')
            .select('id, userName, balance, profilePhoto')
            .order('balance', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Error fetching top users:', error);
            return res.status(500).json({ success: false, message: 'Failed to fetch top users' });
        }

        // Filter out users with null or non-positive balances
        const filteredTopUsers = topUsers.filter(user => user.balance !== null && user.balance > 0);

        console.log("Top 20 users fetched:", filteredTopUsers);

        res.status(200).json({
            success: true,
            topUsers: filteredTopUsers // Return the filtered list
        });
    } catch (err) {
        console.error('Unexpected error:', err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});


app.post('/api/start-session', async (req, res) => {
    const userData = req.body;
    console.log(userData)
    const sessionToken = `session_${userData.id}_${Date.now()}`;

    try {
        const { error } = await supabase.from('sessions').insert({
            sessionToken: sessionToken,
            userId: userData.id,
            firstName: userData.firstName,
            lastName: userData.lastName,
            userName: userData.userName
        });

        if (error) {
            console.error('Error inserting session into Supabase:', error);
            return res.status(500).json({ success: false, message: 'Failed to start session' });
        }

        console.log("Session started for user:", userData);
        console.log("Session token:", sessionToken);


        res.status(200).json({ success: true, sessionToken });
    } catch (err) {
        console.error('Unexpected error:', err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/api/start-newsession', async (req, res) => {
    console.log('Request Body:', req.body);
    const userData = req.body;
    console.log(userData);
    const user = userData.user;
    const sessionToken = `session_${user.id}_${Date.now()}`;
    try {
        const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (!existingUser) {
            const { error: insertError } = await supabase.from('users').insert({
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                userName: user.username,
                profilePhoto: user.photo_url,
                referralLink: `https://t.me/PactonGame_bot?startapp=${user.id}`,
            });

            if (insertError) {
                console.error('Error inserting session into Supabase:', insertError);
                return res.status(500).json({ success: false, message: 'Failed to insert new user' });
            }



            console.log("Row for new user added on supabase table", userData);
            const { data: dataToSend, error: sendError } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();
            if (sendError || !dataToSend) {
                console.error('Error fetching user details:', sendError);
            } else {
                console.log('dataToSend:', dataToSend);
                res.status(200).json(dataToSend);
                const { error } = await supabase.from('sessions').insert({
                    sessionToken: sessionToken,
                    userId: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    userName: user.username,
                    profilePhoto: user.photo_url

                });

                if (error) {
                    console.error('Error inserting session into Supabase:', error);
                    return res.status(500).json({ success: false, message: 'Failed to start session' });
                }

                console.log("Session started for user:", userData);
                console.log("Session token:", sessionToken);
            }
        } else {
            const { data: userData, error: userDetailsError } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (userDetailsError || !userData) {
                console.error('Error fetching user details:', userDetailsError);
                return res.status(404).json({
                    success: false,
                    message: 'User details not found!',
                });
            }


            const now = Date.now();
            console.log("Now date in MS", now);


            if (userData.speedBoosters) {
                const speedDate = new Date(userData.speedBoosters[0]?.validTo).getTime();
                console.log("speedDate", speedDate)
                if (now > speedDate) {
                    userData.speedBoosters = []
                    const { data: updateData, error: updateError } = await supabase
                        .from('users')
                        .update({ speedBoosters: null })
                        .eq('id', user.id)
                    if (updateError) {
                        console.log("updateError:", updateError);
                    } else {
                        console.log("speedbooster removed successfully:", updateData);
                    }
                }
            }
            if (userData.ghostBoosters) {
                const ghostDate = new Date(userData.ghostBoosters[0]?.validTo).getTime();
                console.log("ghostDate", ghostDate)
                if (now > ghostDate) {
                    userData.ghostBoosters = []
                    const { data: updateData, error: updateError } = await supabase
                        .from('users')
                        .update({ ghostBoosters: null })
                        .eq('id', user.id)
                    if (updateError) {
                        console.log("updateError:", updateError);
                    } else {
                        console.log("speedbooster removed successfully:", updateData);
                    }
                }
            }
            if (userData.coinBoosters) {
                const pointsDate = new Date(userData.coinBoosters[0]?.validTo).getTime();
                console.log("pointsDate", pointsDate)
                if (now > pointsDate) {
                    userData.coinBoosters = []
                    const { data: updateData, error: updateError } = await supabase
                        .from('users')
                        .update({ coinBoosters: null })
                        .eq('id', user.id)
                    if (updateError) {
                        console.log("updateError:", updateError);
                    } else {
                        console.log("speedbooster removed successfully:", updateData);
                    }
                }
            }
            console.log("userData before sending", userData);
            const responsePayload = {
                success: true,
                userData: {
                    id: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    userName: user.username,
                    profilePhoto: user.profilePhoto,
                    referralLink: `https://t.me/PactonGame_bot?startapp=${user.id}`,
                    balance: userData.balance,
                    skins: userData.skins,
                    speedBoosters: userData.speedBoosters,
                    ghostBoosters: userData.ghostBoosters,
                    coinBoosters: userData.coinBoosters,
                    preferredWallet: userData.preferredWallet,
                    walletAddress: userData.walletAddress,
                    skinSelected: userData.skinSelected,
                    referrerId: userData.referrerId,
                    sessionToken: sessionToken,
                    pelletsEaten: userData.pelletsEaten,
                    powerPelletsEaten: userData.powerPelletsEaten,
                    ghostsEaten: userData.ghostsEaten,
                    tormentorKillings: userData.tormentorKillings

                },
            };
            const { error } = await supabase.from('sessions').insert({
                sessionToken: sessionToken,
                userId: userData.id,
                firstName: userData.firstName,
                lastName: userData.lastName,
                userName: userData.userName,
                profilePhoto: user.photo_url
            });

            if (error) {
                console.error('Error inserting session into Supabase:', error);
                return res.status(500).json({ success: false, message: 'Failed to start session' });
            }
            res.status(200).json(responsePayload);
        }

    } catch (err) {
        console.error('Unexpected error:', err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.get('/api/check-membership', async (req, res) => {
    const userId = req.query.user_id;

    if (!userId) {
        return res.status(400).json({ error: 'Missing user_id' });
    }

    try {
        const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`, {
            params: {
                chat_id: TELEGRAM_GROUP_ID,
                user_id: userId
            }
        });

        const status = response.data.result?.status;
        const isMember = ['member', 'administrator', 'creator'].includes(status);

        res.json({ isMember });
    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).json({ error: 'Telegram API error' });
    }
});

app.get('/api/get-level-progress', async (req, res) => {
    const { telegramUserId } = req.query;

    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', telegramUserId)
            .single();

        if (error) {
            console.error("Error querying Supabase:", error);
            return res.status(500).json({ success: false, message: "Error querying the database" });
        }

        if (!data) {
            console.log("No user found with the given Telegram User ID.");
            return res.status(404).json({ success: false, message: "User not found" });
        }

        console.log("data received from supabase:", data);

        return res.status(200).json({
            success: true,
            levelProgress: data.levelProgress,
            referrals: data.referrals
        });

    } catch (err) {
        console.error("Server error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

app.get('/api/get-reward-progress', async (req, res) => {
    const { telegramUserId } = req.query;

    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', telegramUserId)
            .single();

        if (error) {
            console.error("Error querying Supabase:", error);
            return res.status(500).json({ success: false, message: "Error querying the database" });
        }

        if (!data) {
            console.log("No user found with the given Telegram User ID.");
            return res.status(404).json({ success: false, message: "User not found" });
        }

        console.log("data received from supabase:", data);

        return res.status(200).json({
            success: true,
            rewardProgress: data.rewardProgress
        });

    } catch (err) {
        console.error("Server error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

app.get('/api/game-session/:adminSessionToken', async (req, res) => {
    const { adminSessionToken } = req.params;
    let canClaim = false;
    const now = Date.now();
    console.log("date now:", now);
    console.log("adminSessionToken:", adminSessionToken);
    try {

        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('sessionToken', adminSessionToken)
            .single();

        if (sessionError || !sessionData) {
            console.error('Session not found or error retrieving session:', sessionError);
            return res.status(404).json({
                success: false,
                message: 'Session not found!',
            });
        }


        const { data: userDetails, error: userDetailsError } = await supabase
            .from('users')
            .select('*')
            .eq('id', sessionData.userId)
            .single();

        if (userDetailsError || !userDetails) {
            console.error('Error fetching user details:', userDetailsError);
            return res.status(404).json({
                success: false,
                message: 'User details not found!',
            });
        }

        const originalDate = new Date(userDetails.lastClaim);

        const updatedDate = originalDate.getTime() + 24 * 60 * 60 * 1000;

        const claimingDate = new Date(originalDate.getTime() + 24 * 60 * 60 * 1000);

        const expiringDate = new Date(originalDate.getTime() + 48 * 60 * 60 * 1000);

        console.log(`originalDate:`, originalDate)
        console.log(`updatedDate:`, updatedDate)
        console.log(`claimingDate:`, claimingDate)
        console.log(`expiringDate:`, expiringDate)
        if (now > expiringDate) {
            userDetails.dailyLogins = 0;
        }
        if (userDetails.speedBoosters) {
            const speedDate = new Date(userDetails.speedBoosters[0]?.validTo).getTime();
            if (now > speedDate) {
                userDetails.speedBoosters = []
                const { data: updateData, error: updateError } = await supabase
                    .from('users')
                    .update({ speedBoosters: null })
                    .eq('id', sessionData.userId)
                if (updateError) {
                    console.log("updateError:", updateError);
                } else {
                    console.log("speedbooster removed successfully:", updateData);
                }
            }
        }
        if (userDetails.ghostBoosters) {
            const ghostDate = new Date(userDetails.ghostBoosters[0]?.validTo).getTime();
            console.log("ghostDate", ghostDate)
            if (now > ghostDate) {
                userDetails.ghostBoosters = []
                const { data: updateData, error: updateError } = await supabase
                    .from('users')
                    .update({ ghostBoosters: null })
                    .eq('id', sessionData.userId)
                if (updateError) {
                    console.log("updateError:", updateError);
                } else {
                    console.log("speedbooster removed successfully:", updateData);
                }
            }
        }
        if (userDetails.coinBoosters) {
            const pointsDate = new Date(userDetails.coinBoosters[0]?.validTo).getTime();
            console.log("pointsDate", pointsDate)
            if (now > pointsDate) {
                userDetails.coinBoosters = []
                const { data: updateData, error: updateError } = await supabase
                    .from('users')
                    .update({ coinBoosters: null })
                    .eq('id', sessionData.userId)
                if (updateError) {
                    console.log("updateError:", updateError);
                } else {
                    console.log("speedbooster removed successfully:", updateData);
                }
            }
        }

        if (now > updatedDate && now < expiringDate) {
            canClaim = true
        } else {
            canClaim = false
        }
        if (userDetails.dailyLogins === 7 && now > updatedDate) {
            userDetails.dailyLogins = 0;
            const { data: updateData, error: updateError } = await supabase
                .from('users')
                .update({ dailyLogins: 0 })
                .eq('id', sessionData.userId)
            if (updateError) {
                console.log("updateError:", updateError);
            } else {
                console.log("dailyLogins reset to 0:", updateData);
            }
        }
        console.log("userDetails before sending", userDetails)
        const responsePayload = {
            success: true,
            userData: {
                userId: sessionData.userId,
                firstName: sessionData.firstName,
                lastName: sessionData.lastName,
                userName: sessionData.userName,
                balance: userDetails.balance,
                dailyLogins: userDetails.dailyLogins,
                lastClaim: userDetails.lastClaim,
                claimingDate: claimingDate,
                canClaim: canClaim,
                preferredWallet: userDetails.preferredWallet,
                /* levelProgress: userDetails.levelProgress,
                rewardProgress: userDetails.rewardProgress, */
                skins: userDetails.skins,
                preferredWallet: userDetails.preferredWallet,
                walletAddress: userDetails.walletAddress,
                speedBoosters: userDetails.speedBoosters,
                ghostBoosters: userDetails.ghostBoosters,
                coinBoosters: userDetails.coinBoosters,
                skinSelected: userDetails.skinSelected,
                profilePhoto: userDetails.profilePhoto,
                referralLink: userDetails.referralLink,
                referrerId: userDetails.referrerId,
                pelletsEaten: userDetails.pelletsEaten,
                powerPelletsEaten: userDetails.powerPelletsEaten,
                ghostsEaten: userDetails.ghostsEaten,
                tormentorKillings: userDetails.tormentorKillings
            },
        };

        res.status(200).json(responsePayload);
    } catch (err) {
        console.error('Unexpected error:', err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});




app.post('/api/update-level-user', async (req, res) => {
    try {
        let { userId, id, userName, firstName } = req.body;

        if (!userId || !id || isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide both sessionToken and valid level number.' });
        }

        console.log("Request received:", { userId, id, userName, firstName });

        const { data: levelData, error: levelError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (levelError || !levelData) {
            console.error('Error retrieving levels:', levelError);
            return res.status(500).json({ success: false, message: 'Failed to retrieve levels' });
        }

        let levelProgress = levelData.levelProgress;

        let levelIndex = levelProgress.findIndex(l => l.id === id);
        console.log("levelIndex:", levelIndex);
        if (levelIndex === -1) {
            return res.status(400).json({ success: false, message: 'Level number out of range' });
        }

        levelProgress[levelIndex].isU = true;

        if (levelIndex > 0) {
            levelProgress[levelIndex - 1].isC = true;
        }
        const now = new Date();
        console.log("now: ", now);
        if (levelData.speedBoosters) {
            const speedDate = new Date(levelData.speedBoosters[0]?.validTo).getTime();
            console.log("speedDate", speedDate)
            if (now > speedDate) {
                levelData.speedBoosters = []
                const { data: updateData, error: updateError } = await supabase
                    .from('users')
                    .update({ speedBoosters: null })
                    .eq('id', userId)
                if (updateError) {
                    console.log("updateError:", updateError);
                } else {
                    console.log("speedbooster removed successfully:", updateData);
                }
            }
        }
        if (levelData.ghostBoosters) {
            const ghostDate = new Date(levelData.ghostBoosters[0]?.validTo).getTime();
            console.log("ghostDate", ghostDate)
            if (now > ghostDate) {
                levelData.ghostBoosters = []
                const { data: updateData, error: updateError } = await supabase
                    .from('users')
                    .update({ ghostBoosters: null })
                    .eq('id', userId)
                if (updateError) {
                    console.log("updateError:", updateError);
                } else {
                    console.log("speedbooster removed successfully:", updateData);
                }
            }
        }
        if (levelData.coinBoosters) {
            const pointsDate = new Date(levelData.coinBoosters[0]?.validTo).getTime();
            console.log("pointsDate", pointsDate)
            if (now > pointsDate) {
                levelData.coinBoosters = []
                const { data: updateData, error: updateError } = await supabase
                    .from('users')
                    .update({ coinBoosters: null })
                    .eq('id', userId)
                if (updateError) {
                    console.log("updateError:", updateError);
                } else {
                    console.log("speedbooster removed successfully:", updateData);
                }
            }
        }


        const { error: updateError } = await supabase
            .from('users')
            .update({ levelProgress })
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating level progress:', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update level progress' });
        }
        const newLevel = levelIndex + 1;
        if (newLevel > 0 && newLevel % 10 === 0) {
            console.log("Sending message to Telegram...");

            let name = levelData.userName || levelData.firstName || 'Someone';
            const milestoneImageUrl = 'https://i.imghippo.com/files/DnL6602JQk.jpg'; // Must be a valid image URL
            const message = `🔐 @${name} has unlocked level ${newLevel}!\n\nCongratulations!!! 🎉🎉🎉`;

            const form = new FormData();
            form.append('chat_id', TELEGRAM_CHAT_ID);
            form.append('photo', milestoneImageUrl);
            form.append('caption', message);

            try {
                await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, form, {
                    headers: form.getHeaders()
                });
                console.log("Telegram photo message sent.");
            } catch (telegramError) {
                console.error("Failed to send Telegram photo message:", telegramError.response?.data || telegramError.message);
            }
        }
        res.status(200).json({ success: true, message: 'Level progress updated successfully.' });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.get('/api/update-user/:userId', async (req, res) => {
    try {
        let { userId } = req.params;

        console.log("userId", userId);

        if (!userId || isNaN(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide valid userId.' });
        }

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            console.error('User not found:', userError);
            return res.status(404).json({ success: false, message: 'User not found!' });
        } else {
            const responsePayload = {
                success: true,
                userData: {
                    userId: userId,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    userName: userData.userName,
                    balance: userData.balance,
                    dailyLogins: userData.dailyLogins,
                    lastClaim: userData.lastClaim,
                    claimingDate: userData.claimingDate,
                    skins: userData.skins,
                    speedBoosters: userData.speedBoosters,
                    ghostBoosters: userData.ghostBoosters,
                    coinBoosters: userData.coinBoosters,
                    skinSelected: userData.skinSelected,
                    profilePhoto: userData.profilePhoto,
                    referralLink: userData.referralLink,
                    referrerId: userData.referrerId,
                    pelletsEaten: userData.pelletsEaten,
                    powerPelletsEaten: userData.powerPelletsEaten,
                    ghostsEaten: userData.ghostsEaten,
                    tormentorKillings: userData.tormentorKillings,
                    preferredWallet: userData.preferredWallet,
                    walletAddress: userData.walletAddress
                },
            };

            res.status(200).json(responsePayload);
        }
    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/update-balance-admin', async (req, res) => {
    try {
        let { adminSessionToken, score, pelletsEaten, powerPelletsEaten, ghostsEaten } = req.body;

        if (!adminSessionToken || !score || isNaN(score)) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide both sessionToken and valid score.' });
        }

        console.log("Request received:", { adminSessionToken, score, pelletsEaten, powerPelletsEaten });
        if (adminSessionToken.includes('#')) {
            adminSessionToken = adminSessionToken.split('#')[0];
        }
        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('sessionToken', adminSessionToken)
            .single();

        if (sessionError || !sessionData) {
            console.error('Session not found:', sessionError);
            return res.status(404).json({ success: false, message: 'Session not found!' });
        }

        const sessionPelletsEaten = sessionData.pelletsEaten
        const sessionPowerPelletsEaten = sessionData.powerPelletsEaten
        const sessionEarnedBalance = sessionData.earnedBalance
        const sessionGhostsEaten = sessionData.ghostsEaten
        const newSessionPelletsEaten = sessionPelletsEaten + pelletsEaten
        const newSessionPowerPelletsEaten = sessionPowerPelletsEaten + powerPelletsEaten
        const newSessionEarnedBalance = sessionEarnedBalance + score
        const newSessionGhostsEaten = sessionGhostsEaten + ghostsEaten
        const existingRewards = sessionData.rewards || []

        const { data: balanceData, error: balanceError } = await supabase
            .from('users')
            .select('*')
            .eq('id', sessionData.userId)
            .single();

        if (balanceError || !balanceData) {
            console.error('Error retrieving levels:', balanceError);
            return res.status(500).json({ success: false, message: 'Failed to retrieve levels' });
        }

        const newBalance = balanceData.balance + score;
        const newPelletsEaten = balanceData.pelletsEaten + pelletsEaten
        const newPowerPelletsEaten = balanceData.powerPelletsEaten + powerPelletsEaten
        const newGhostsEaten = balanceData.ghostsEaten + ghostsEaten

        const { error: updateError } = await supabase
            .from('users')
            .update({ balance: newBalance, pelletsEaten: newPelletsEaten, powerPelletsEaten: newPowerPelletsEaten, ghostsEaten: newGhostsEaten })
            .eq('id', sessionData.userId);

        if (updateError) {
            console.error('Error updating score on users', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update balance and pellets' });
        }

        const rewards = {
            amount: score,
            pelletsEaten: pelletsEaten,
            powerPelletsEaten: powerPelletsEaten,
            ghostsEaten: ghostsEaten,
            subject: "Playing Game"
        }

        const newRewards = [...existingRewards, rewards]

        const { error: updateSessionError } = await supabase
            .from('sessions')
            .update({ earnedBalance: newSessionEarnedBalance, pelletsEaten: newSessionPelletsEaten, powerPelletsEaten: newSessionPowerPelletsEaten, ghostsEaten: newSessionGhostsEaten, rewards: newRewards })
            .eq('sessionToken', adminSessionToken);

        if (updateSessionError) {
            console.error('Error updating score on sessions', updateSessionError);
            return res.status(500).json({ success: false, message: 'Failed to update balance and pellets' });
        }

        res.status(200).json({ success: true, message: 'Score and pellets updated successfully.' });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/update-balance-user', async (req, res) => {
    try {
        let { userId, score, pelletsEaten, powerPelletsEaten, ghostsEaten, sessionToken } = req.body;



        if (!userId || !score || isNaN(score)) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide both sessionToken and valid score.' });
        }

        console.log("Request received:", { userId, score, pelletsEaten, powerPelletsEaten, ghostsEaten, sessionToken });

        const { data: balanceData, error: balanceError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (balanceError || !balanceData) {
            console.error('Error retrieving balance from supabase:', balanceError);
            return res.status(500).json({ success: false, message: 'Error retrieving balance from supabase' });
        }
        const now = new Date();
        console.log("now: ", now);
        if (balanceData.speedBoosters) {
            const speedDate = new Date(balanceData.speedBoosters[0]?.validTo).getTime();
            console.log("speedDate", speedDate)
            if (now > speedDate) {
                balanceData.speedBoosters = []
                const { data: updateData, error: updateError } = await supabase
                    .from('users')
                    .update({ speedBoosters: null })
                    .eq('id', userId)
                if (updateError) {
                    console.log("updateError:", updateError);
                } else {
                    console.log("speedbooster removed successfully");
                }
            }
        }
        if (balanceData.ghostBoosters) {
            const ghostDate = new Date(balanceData.ghostBoosters[0]?.validTo).getTime();
            console.log("ghostDate", ghostDate)
            if (now > ghostDate) {
                balanceData.ghostBoosters = []
                const { data: updateData, error: updateError } = await supabase
                    .from('users')
                    .update({ ghostBoosters: null })
                    .eq('id', userId)
                if (updateError) {
                    console.log("updateError:", updateError);
                } else {
                    console.log("ghostBoosters removed successfully");
                }
            }
        }
        if (balanceData.coinBoosters) {
            const pointsDate = new Date(balanceData.coinBoosters[0]?.validTo).getTime();
            console.log("pointsDate", pointsDate)
            if (now > pointsDate) {
                balanceData.coinBoosters = []
                const { data: updateData, error: updateError } = await supabase
                    .from('users')
                    .update({ coinBoosters: null })
                    .eq('id', userId)
                if (updateError) {
                    console.log("updateError:", updateError);
                } else {
                    console.log("coinBoosters removed successfully");
                }
            }
        }

        const newBalance = balanceData.balance + score;
        const newPelletsEaten = balanceData.pelletsEaten + pelletsEaten;
        const newPowerPelletsEaten = balanceData.powerPelletsEaten + powerPelletsEaten;
        const newGhostsEaten = balanceData.ghostsEaten + ghostsEaten;
        const { error: updateError } = await supabase
            .from('users')
            .update({ balance: newBalance, pelletsEaten: newPelletsEaten, powerPelletsEaten: newPowerPelletsEaten, ghostsEaten: newGhostsEaten })
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating score', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update level progress' });
        }

        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('sessionToken', sessionToken)
            .single();

        if (sessionError || !sessionData) {
            console.error('Error retrieving session:', sessionError);
            return res.status(500).json({ success: false, message: 'Failed to retrieve session' });
        }

        const newSessionEarnedBalance = sessionData.earnedBalance + score;
        const newSessionPelletsEaten = sessionData.pelletsEaten + pelletsEaten;
        const newSessionPowerPelletsEaten = sessionData.powerPelletsEaten + powerPelletsEaten;
        const newSessionGhostsEaten = sessionData.ghostsEaten + ghostsEaten;
        const existingRewards = sessionData.rewards || []

        const rewards = {
            amount: score,
            pelletsEaten: pelletsEaten,
            powerPelletsEaten: powerPelletsEaten,
            ghostsEaten: ghostsEaten,
            subject: "Playing Game"
        }

        const newRewards = [...existingRewards, rewards]

        const { error: updateSessionError } = await supabase
            .from('sessions')
            .update({ earnedBalance: newSessionEarnedBalance, pelletsEaten: newSessionPelletsEaten, powerPelletsEaten: newSessionPowerPelletsEaten, ghostsEaten: newSessionGhostsEaten, rewards: newRewards })
            .eq('sessionToken', sessionToken);

        if (updateSessionError) {
            console.error('Error updating score on sessions', updateSessionError);
            return res.status(500).json({ success: false, message: 'Failed to update balance and pellets' });
        }

        res.status(200).json({ success: true, message: 'Score and pellets updated successfully.' });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/update-mission-user', async (req, res) => {
    try {
        let { userId, reward, missionTitle, sessionToken } = req.body;



        if (!userId || !reward || !missionTitle || isNaN(reward)) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide both sessionToken and valid score.' });
        }

        console.log("Request received:", { userId, reward, missionTitle, sessionToken });

        const { data: missionData, error: missionError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (missionError || !missionData) {
            console.error('Error retrieving balance from supabase:', missionError);
            return res.status(500).json({ success: false, message: 'Error retrieving balance from supabase' });
        }

        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('sessionToken', sessionToken)
            .single();

        if (sessionError || !sessionData) {
            console.error('Error retrieving session:', sessionError);
            return res.status(500).json({ success: false, message: 'Failed to retrieve session' });
        }

        const existingRewards = sessionData.rewards || []
        const earned = sessionData.earnedBalance || 0;

        console.log("earned:", earned)

        function updateRewardProgress(rewardProgress, missionTitle, reward) {
            let remainingReward = reward;

            return rewardProgress.map(entry => {
                if (entry.title === missionTitle && !entry.isClaimed && remainingReward >= entry.reward) {
                    remainingReward -= entry.reward;
                    return { ...entry, isClaimed: true };
                }
                return entry;
            });
        }
        const updatedProgress = updateRewardProgress(missionData.rewardProgress, missionTitle, reward);
        const newBalance = missionData.balance + reward;
        const newEarned = earned + reward;
        console.log("newEarned:", newEarned);
        const { error: updateError } = await supabase
            .from('users')
            .update({ rewardProgress: updatedProgress, balance: newBalance })
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating score on users', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update balance and pellets' });
        }

        const missionUnlocked = {
            missionTitle: missionTitle,
            reward: reward,
            subject: "Mission Unlocked"
        }

        const newRewards = [...existingRewards, missionUnlocked]
        const { error: updateSessionError } = await supabase
            .from('sessions')
            .update({ rewards: newRewards, earnedBalance: newEarned })
            .eq('sessionToken', sessionToken);

        if (updateSessionError) {
            console.error('Error updating score on sessions', updateSessionError);
            return res.status(500).json({ success: false, message: 'Failed to update balance and pellets' });
        }
        let name = missionData.userName || missionData.firstName || 'Someone';
        const milestoneImageUrl = 'https://i.imghippo.com/files/hjfB4503IP.png';
        const message = `🔥 @${name} has completed mission ${missionTitle} and earned ${reward} PCTN!!!\n\nCongratulations!!! 🎉🎉🎉`;
        console.log("message to be sent", message);
        const form = new FormData();
        form.append('chat_id', TELEGRAM_CHAT_ID);
        form.append('photo', milestoneImageUrl);
        form.append('caption', message);

        try {
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, form, {
                headers: form.getHeaders()
            });
            console.log("Telegram photo message sent.");
        } catch (telegramError) {
            console.error("Failed to send Telegram photo message:", telegramError.response?.data || telegramError.message);
        }

        res.status(200).json({ success: true, reward: reward, message: 'Score and pellets updated successfully.' });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/claimReferralReward-admin', async (req, res) => {
    const { adminSessionToken, referralId } = req.body;
    try {
        if (!adminSessionToken || !referralId) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide both sessionToken and referralId' });
        }

        console.log("Request received:", { adminSessionToken, referralId });

        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('sessionToken', adminSessionToken)
            .single();

        if (sessionError || !sessionData) {
            console.error('Session not found:', sessionError);
            return res.status(404).json({ success: false, message: 'Session not found!' });
        }

        const { data: missionData, error: missionError } = await supabase
            .from('users')
            .select('*')
            .eq('id', sessionData.userId)
            .single();

        if (missionError || !missionData) {
            console.error('Error retrieving levels:', missionError);
            return res.status(500).json({ success: false, message: 'Failed to retrieve rewardProgress' });
        }

        const updatedReferrals = (missionData.referrals || []).map(ref => {
            if (String(ref.referralId) === String(referralId)) {
                return { ...ref, isClaimed: true };
            }
            return ref;
        });
        console.log("updatedReferrals:", updatedReferrals);
        // Update balance (e.g., +100 points)
        const newBalance = (missionData.balance || 0) + 25000;
        console.log("newBalance:", newBalance);
        const { error: updateError } = await supabase
            .from('users')
            .update({ referrals: updatedReferrals, balance: newBalance })
            .eq('id', sessionData.userId);

        if (updateError) {
            return res.status(500).json({ success: false, message: "Failed to update user" });
        }

        return res.json({
            success: true,
            message: "Referral reward claimed",
            newBalance
        });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/update-mission-admin', async (req, res) => {
    try {
        let { adminSessionToken, reward, missionTitle } = req.body;
        if (!adminSessionToken || !reward || !missionTitle || isNaN(reward)) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide both sessionToken and valid score.' });
        }

        console.log("Request received:", { adminSessionToken, reward, missionTitle });

        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('sessionToken', adminSessionToken)
            .single();

        if (sessionError || !sessionData) {
            console.error('Session not found:', sessionError);
            return res.status(404).json({ success: false, message: 'Session not found!' });
        }

        const { data: missionData, error: missionError } = await supabase
            .from('users')
            .select('*')
            .eq('id', sessionData.userId)
            .single();

        if (missionError || !missionData) {
            console.error('Error retrieving levels:', missionError);
            return res.status(500).json({ success: false, message: 'Failed to retrieve rewardProgress' });
        }

        console.log("rewardProgress:", missionData.rewardProgress);

        function updateRewardProgress(rewardProgress, missionTitle, reward) {
            let remainingReward = reward; // Start with the total reward amount sent from the game

            return rewardProgress.map(entry => {
                // Check if the entry matches the mission title and is not yet claimed
                if (entry.title === missionTitle && !entry.isClaimed && remainingReward >= entry.reward) {
                    remainingReward -= entry.reward; // Deduct the reward for this milestone from the remaining reward
                    return { ...entry, isClaimed: true }; // Mark this milestone as claimed
                }
                return entry; // Leave other entries unchanged
            });
        }
        const updatedProgress = updateRewardProgress(missionData.rewardProgress, missionTitle, reward);
        const newBalance = missionData.balance + reward;

        console.log("updatedProgress:", updatedProgress);
        const { error: updateError } = await supabase
            .from('users')
            .update({ rewardProgress: updatedProgress, balance: newBalance })
            .eq('id', sessionData.userId);

        if (updateError) {
            console.error('Error updating score on users', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update balance and pellets' });
        }

        res.status(200).json({ success: true, reward: reward, message: 'Reward Progress updated successfully.' });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.get('/api/test', (req, res) => {
    res.status(200).json({ success: true, message: 'Server is running!' });
});

app.post('/api/update-skinNumber', async (req, res) => {
    try {
        let { skinId, sessionToken } = req.body;
        if (!sessionToken || !skinId || isNaN(skinId)) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide both sessionToken and valid skinId.' });
        }

        if (sessionToken.includes('#')) {
            sessionToken = sessionToken.split('#')[0];
        }

        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('sessionToken', sessionToken)
            .single();

        if (sessionError || !sessionData) {
            console.error('Session not found or error retrieving session:', sessionError);
            return res.status(404).json({ success: false, message: 'Session not found!' });
        }

        const { data: skinData, error: skinError } = await supabase
            .from('users')
            .select('skins')
            .eq('id', sessionData.userId)
            .single();

        if (skinError || !skinData) {
            console.error('Error retrieving skins:', skinError);
            return res.status(500).json({ success: false, message: 'Failed to retrieve skins' });
        }

        const updatedSkins = skinData.coloured_skins.map(skin => ({
            ...skin,
            inUse: skin.id === parseInt(skinId) // Set inUse to true for the selected skin, false for others
        }));

        const { error: updateError } = await supabase
            .from('users')
            .update({ skins: updatedSkins })
            .eq('id', sessionData.userId);

        if (updateError) {
            console.error('Error updating skins:', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update skins' });
        }

        console.log('Skins updated successfully');
        return res.status(200).json({ success: true, message: 'Skin updated successfully', updatedSkins });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/buy-skinNumber-admin', async (req, res) => {
    try {
        let { adminSessionToken, skinId, balance } = req.body;

        if (!adminSessionToken || !skinId || !balance || isNaN(skinId) || isNaN(balance)) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide both sessionToken and valid skinId.' });
        }

        if (adminSessionToken.includes('#')) {
            adminSessionToken = adminSessionToken.split('#')[0];
        }

        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('sessionToken', adminSessionToken)
            .single();

        if (sessionError || !sessionData) {
            console.error('Session not found or error retrieving session:', sessionError);
            return res.status(404).json({ success: false, message: 'Session not found!' });
        }

        const { data: skinData, error: skinError } = await supabase
            .from('users')
            .select('skins')
            .eq('id', sessionData.userId)
            .single();

        if (skinError || !skinData) {
            console.error('Error retrieving skins:', skinError);
            return res.status(500).json({ success: false, message: 'Failed to retrieve skins' });
        }
        let skinFound = false;
        let skinPrice
        let skins = skinData.skins;
        let updatedSkins = skins.map(skin => {
            if (skin.id === skinId) {
                skinFound = true;
                skinPrice = skin.price
                return { ...skin, isPurchased: true };
            }
            return skin;
        });

        let newBalace = balance - skinPrice
        const { error: updateError } = await supabase
            .from('users')
            .update({ skins: updatedSkins, balance: newBalace })
            .eq('id', sessionData.userId);

        if (updateError) {
            console.error('Error updating skins:', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update skins' });
        }

        console.log('Skins updated successfully');
        return res.status(200).json({ success: true, message: 'Skin updated successfully', updatedSkins });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/buy-skinNumber-user', async (req, res) => {
    try {
        let { userId, skinId, balance } = req.body;

        if (!userId || !skinId || !balance || isNaN(skinId) || isNaN(balance)) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide both sessionToken and valid skinId.' });
        }

        const { data: skinData, error: skinError } = await supabase
            .from('users')
            .select('skins')
            .eq('id', userId)
            .single();

        if (skinError || !skinData) {
            console.error('Error retrieving skins:', skinError);
            return res.status(500).json({ success: false, message: 'Failed to retrieve skins' });
        }
        let skinFound = false;
        let skinPrice
        let skins = skinData.skins;
        let updatedSkins = skins.map(skin => {
            if (skin.id === skinId) {
                skinFound = true;
                skinPrice = skin.price
                return { ...skin, isPurchased: true };
            }
            return skin;
        });

        let newBalace = balance - skinPrice
        const { error: updateError } = await supabase
            .from('users')
            .update({ skins: updatedSkins, balance: newBalace })
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating skins:', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update skins' });
        }

        console.log('Skins updated successfully');
        return res.status(200).json({ success: true, message: 'Skin updated successfully', updatedSkins });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/preferred-wallet-admin', async (req, res) => {
    try {
        let { adminSessionToken, preferredWallet } = req.body;

        console.log("adminSessionToken:", adminSessionToken);
        console.log("preferredWallet:", preferredWallet);

        if (!adminSessionToken || !preferredWallet) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide both sessionToken and valid preferredWallet.' });
        }

        if (adminSessionToken.includes('#')) {
            adminSessionToken = adminSessionToken.split('#')[0];
        }


        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('sessionToken', adminSessionToken)
            .single();

        if (sessionError || !sessionData) {
            console.error('Session not found or error retrieving session:', sessionError);
            return res.status(404).json({
                success: false,
                message: 'Session not found!',
            });
        }


        const { error: updateError } = await supabase
            .from('users')
            .update({ preferredWallet: preferredWallet })
            .eq('id', sessionData.userId);

        if (updateError) {
            console.error('Error updating admin wallet:', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update login days' });
        }

        res.status(200).json({ success: true, message: 'Admin Wallet updated successfully.' });
    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/wallet-address-admin', async (req, res) => {
    try {
        let { adminSessionToken, walletAddress } = req.body;

        console.log("adminSessionToken:", adminSessionToken);
        console.log("preferredWallet:", walletAddress);

        if (!adminSessionToken || !walletAddress) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide both sessionToken and valid walletAddress.' });
        }

        if (adminSessionToken.includes('#')) {
            adminSessionToken = adminSessionToken.split('#')[0];
        }


        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('sessionToken', adminSessionToken)
            .single();

        if (sessionError || !sessionData) {
            console.error('Session not found or error retrieving session:', sessionError);
            return res.status(404).json({
                success: false,
                message: 'Session not found!',
            });
        }


        const { error: updateError } = await supabase
            .from('users')
            .update({ walletAddress: walletAddress })
            .eq('id', sessionData.userId);

        if (updateError) {
            console.error('Error updating admin wallet:', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update login days' });
        }

        res.status(200).json({ success: true, message: 'Admin walletAddress updated successfully.' });
    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});


app.post('/api/cashout', async (req, res) => {
    try {
        let { userId, score, sessionToken } = req.body;



        if (!userId || !score || isNaN(score)) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide both sessionToken and valid score.' });
        }

        console.log("Request received:", { userId, score, sessionToken });

        const { data: balanceData, error: balanceError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (balanceError || !balanceData) {
            console.error('Error retrieving balance from supabase:', balanceError);
            return res.status(500).json({ success: false, message: 'Error retrieving balance from supabase' });
        }

        const newBalance = balanceData.balance + score;
        console.log("newBalance:", newBalance)
        const { error: updateError } = await supabase
            .from('users')
            .update({ balance: newBalance })
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating score', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update level progress' });
        }

        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('sessionToken', sessionToken)
            .single();

        if (sessionError || !sessionData) {
            console.error('Error retrieving session:', sessionError);
            return res.status(500).json({ success: false, message: 'Failed to retrieve session' });
        }

        const newSessionEarnedBalance = sessionData.earnedBalance + score;
        console.log("newSessionEarnedBalance:", newSessionEarnedBalance)
        const initialProgress = sessionData.rewards || []
        const now = new Date().toISOString();
        const newProgress = {
            initialBalance: balanceData.balance,
            earnedBalance: score,
            date: now,
            subject: "Tiles Game"
        }
        const finalProgress = [...initialProgress, newProgress]
        const { error: updateSessionError } = await supabase
            .from('sessions')
            .update({ rewards: finalProgress, earnedBalance: newSessionEarnedBalance })
            .eq('sessionToken', sessionToken);

        if (updateSessionError) {
            console.error('Error updating score on sessions', updateSessionError);
            return res.status(500).json({ success: false, message: 'Failed to update balance and pellets' });
        }

        res.status(200).json({ success: true, message: 'Balance updated successfully.' });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/preferred-wallet-user', async (req, res) => {
    try {
        let { userId, preferredWallet } = req.body;

        console.log("sessionToken:", userId);
        console.log("preferredWallet:", preferredWallet);

        if (!userId || !preferredWallet) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide both sessionToken and valid preferredWallet.' });
        }



        const { error: updateError } = await supabase
            .from('users')
            .update({ preferredWallet: preferredWallet })
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating login days:', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update login days' });
        }

        res.status(200).json({ success: true, message: 'UserWallet updated successfully.' });
    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/wallet-address-user', async (req, res) => {
    try {
        let { userId, walletAddress } = req.body;

        console.log("sessionToken:", userId);
        console.log("preferredWallet:", walletAddress);

        if (!userId || !walletAddress) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide both sessionToken and valid walletAddress.' });
        }



        const { error: updateError } = await supabase
            .from('users')
            .update({ walletAddress: walletAddress })
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating walletAddress:', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update walletAddress' });
        }

        res.status(200).json({ success: true, message: 'walletAddress updated successfully.' });
    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/get-reward-status', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }

    // Fetch user
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (error || !user) {
        return res.status(500).json({ error: 'User lookup failed' });
    }

    const now = Date.now();
    console.log("now: ", now);
    const lastClaim = user.lastClaimMS || 0;
    console.log("lastClaim: ", lastClaim);
    const timeSinceLastClaim = now - lastClaim;
    console.log("timeSinceLastClaim: ", timeSinceLastClaim);
    const oneDay = 24 * 60 * 60 * 1000;
    const twoDays = 2 * oneDay;

    let claimable = false;
    let nextClaimAvailableAt = lastClaim + oneDay;
    let dailyLogins = user.dailyLogins || 0;

    const rawLoginCount = user.dailyLogins || 0;
    const cycleDay = ((rawLoginCount - 1) % 7) + 1;
    console.log("cycleDay: ", cycleDay);

    /* // ⛔ If more than 2 days passed, reset the streak
    if (timeSinceLastClaim > twoDays) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ dailyLogins: 0 })
        .eq('id', userId);
  
      if (updateError) {
        console.error('Failed to reset dailyLogins:', updateError);
        return res.status(500).json({ error: 'Failed to reset dailyLogins' });
      }
      console.log("Resetting dailyLogins due to expiration");
      dailyLogins = 0; // ✅ make sure this is reflected in response
    }
  
    // ✅ If enough time passed for a new reward
    if (timeSinceLastClaim >= oneDay) {
      claimable = true;
      nextClaimAvailableAt = now;
    } */

    if (timeSinceLastClaim >= oneDay) {
        claimable = true;
        nextClaimAvailableAt = now;
    }

    return res.json({
        claimable,
        lastClaim,
        cycleDay,
        nextClaimAvailableAt,
    });
});




app.post('/api/daily-logins', async (req, res) => {
    try {
        let { userId, dailyLogins, balance, sessionToken } = req.body;

        console.log("dailyLogins received:", dailyLogins);
        console.log("sessionToken:", userId);
        console.log("balance:", balance);

        const cycleDay = ((dailyLogins - 1) % 7) + 1;
        console.log("cycleDay: ", cycleDay);

        if (!userId || !dailyLogins || isNaN(dailyLogins)) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide both sessionToken and valid dailyLogins.' });
        }

        const { data: balanceData, error: balanceError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (balanceError || !balanceData) {
            console.error('Error retrieving balance from supabase:', balanceError);
            return res.status(500).json({ success: false, message: 'Error retrieving balance from supabase' });
        }

        const rewards = {
            1: 1000,
            2: 5000,
            3: 10000,
            4: 25000,
            5: 50000,
            6: 100000,
            7: 250000,
        };
        const reward = rewards[cycleDay]
        const now = Date.now();
        console.log("reward:", reward);
        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('sessionToken', sessionToken)
            .single();

        if (sessionError || !sessionData) {
            console.error('Session not found or error retrieving session:', sessionError);
            return res.status(404).json({
                success: false,
                message: 'Session not found!',
            });
        }
        const existingRewards = sessionData.rewards || [];
        const earnedBalance = sessionData.earnedBalance || 0;
        const newEarnedBalance = earnedBalance + reward;
        const time = new Date();
        const price = {
            amount: reward,
            dailyLogins: dailyLogins,
            subject: "Daily Login Claim",
            time: time
        }

        const newRewards = [...existingRewards, price]
        const { error: updateSessionError } = await supabase
            .from('sessions')
            .update({ rewards: newRewards, earnedBalance: newEarnedBalance })
            .eq('sessionToken', sessionToken);

        if (updateSessionError) {
            console.error('Error updating daily logins on sessions', updateSessionError);
            return res.status(500).json({ success: false, message: 'Failed to update daily logins' });
        }

        const newBalance = balance + reward

        const { error: updateError } = await supabase
            .from('users')
            .update({ balance: newBalance, dailyLogins: dailyLogins, lastClaimMS: now })
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating login days:', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update login days' });
        }

        res.status(200).json({
            success: true, message: 'Daily logins updated successfully.', reward: reward, nextClaimAvailableAt: Date.now() + 24 * 60 * 60 * 1000, userData: {
                ...balanceData,
                balance: newBalance
            }
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/skinSelectedAdmin', async (req, res) => {
    try {
        let { skinSelected, adminSessionToken } = req.body;

        console.log("sessionToken:", adminSessionToken);
        console.log("skinSelected:", skinSelected);

        if (!adminSessionToken || !skinSelected || isNaN(skinSelected)) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide both sessionToken and valid dailyLogins.' });
        }

        if (adminSessionToken.includes('#')) {
            adminSessionToken = adminSessionToken.split('#')[0];
        }

        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('sessionToken', adminSessionToken)
            .single();

        if (sessionError || !sessionData) {
            console.error('Session not found or error retrieving session:', sessionError);
            return res.status(404).json({
                success: false,
                message: 'Session not found!',
            });
        }

        const { error: updateError } = await supabase
            .from('users')
            .update({ skinSelected: skinSelected })
            .eq('id', sessionData.userId);

        if (updateError) {
            console.error('Error updating skinSelected:', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update skins' });
        }

        res.status(200).json({ success: true, message: 'skinSelected updated successfully.' });
    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/skinSelectedUser', async (req, res) => {
    try {
        let { userId, skinSelected } = req.body;

        console.log("userId:", userId);
        console.log("skinSelected:", skinSelected);

        if (!userId || !skinSelected || isNaN(skinSelected)) {
            return res.status(400).json({ success: false, message: 'Invalid input. Please provide both sessionToken and valid dailyLogins.' });
        }

        const { error: updateError } = await supabase
            .from('users')
            .update({ skinSelected: skinSelected })
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating skinSelected:', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update skins' });
        }

        res.status(200).json({ success: true, message: 'skinSelected updated successfully.' });
    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/buy-speedBooster-admin', async (req, res) => {
    try {
        let { adminSessionToken, price, duration } = req.body;

        if (!adminSessionToken || !price || !duration) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input. Please provide adminSessionToken, price, and duration.'
            });
        }

        console.log("Request received:", { adminSessionToken, price, duration });

        if (adminSessionToken.includes('#')) {
            adminSessionToken = adminSessionToken.split('#')[0];
        }

        const now = new Date();
        const validTo = new Date(now.getTime() + duration * 60 * 60 * 1000);
        const formatToPostgresTimestamp = (date) => {
            return date.toISOString().replace('T', ' ').replace('Z', '+00');
        };

        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('sessionToken', adminSessionToken)
            .single();

        if (sessionError || !sessionData) {
            console.error('Session not found or error retrieving session:', sessionError);
            return res.status(404).json({
                success: false,
                message: 'Session not found!',
            });
        }

        console.log("Session Data:", sessionData);

        const userId = sessionData.userId;

        if (!userId) {
            return res.status(404).json({
                success: false,
                message: 'User not found!',
            });
        }

        const boosterData = {
            duration: duration,
            price: price,
            boughtOn: formatToPostgresTimestamp(now),
            validTo: formatToPostgresTimestamp(validTo),
            type: "speedBooster"
        };
        const updatedBoosters = [boosterData];

        const { error: updateError } = await supabase
            .from('users')
            .update({ speedBoosters: updatedBoosters })
            .eq('id', userId);

        if (updateError) {
            console.error("Error updating speed booster:", updateError);
            return res.status(500).json({ success: false, message: 'Failed to update speed booster.' });
        }

        console.log("Speed booster successfully added:", boosterData);

        res.status(200).json({
            success: true,
            message: 'Speed booster purchased successfully.',
            booster: boosterData
        });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/buy-speedBooster-user', async (req, res) => {
    try {
        let { userId, price, duration, tonPrice } = req.body;

        if (!userId || !price || !duration) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input. Please provide userId, price, and duration.'
            });
        }

        console.log("Request received:", { userId, price, duration });

        const now = new Date();
        const validTo = new Date(now.getTime() + duration * 60 * 60 * 1000);
        const formatToPostgresTimestamp = (date) => {
            return date.toISOString().replace('T', ' ').replace('Z', '+00');
        };
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            console.error("Error querying Supabase:", userError);
            return res.status(404).json({ success: false, message: "User not found or error retrieving user" });
        }

        const prevBoosters = userData.boostersPurchased || []

        const boosterData = {
            duration: duration,
            price: price,
            boughtOn: formatToPostgresTimestamp(now),
            validTo: formatToPostgresTimestamp(validTo),
            tonPrice: tonPrice,
            type: "speedBooster"
        };
        const updatedBoosters = [boosterData];
        const allBoosters = [...prevBoosters, boosterData]
        const { error: updateError } = await supabase
            .from('users')
            .update({ speedBoosters: updatedBoosters, boostersPurchased: allBoosters })
            .eq('id', userId);

        if (updateError) {
            console.error("Error updating speed booster:", updateError);
            return res.status(500).json({ success: false, message: 'Failed to update speed booster.' });
        }

        console.log("Speed booster successfully added:", boosterData);

        res.status(200).json({
            success: true,
            message: 'Speed booster purchased successfully.',
            booster: boosterData
        });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/buy-balanceBooster-user', async (req, res) => {
    try {
        let { userId, price, balanceAmount } = req.body;

        if (!userId || !price || !balanceAmount) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input. Please provide userId, price, and balanceAmount.'
            });
        }

        console.log("Request received:", { userId, price, balanceAmount });

        const now = new Date();


        const boosterData = {
            price: price,
            balanceAmount: balanceAmount,
            boughtOn: now,
        };
        const updatedBoosters = [boosterData];

        const { data: balanceData, error: balanceError } = await supabase
            .from('users')
            .select('balance')
            .eq('id', userId);
        console.log("user balance before purchase:", balanceData.balance);
        if (balanceError) {
            console.error("Error retrieving data:", balanceError);
            return res.status(500).json({ success: false, message: 'Failed to update balance booster.' });
        }
        if (balanceData) {
            const newBalance = balanceData[0].balance + balanceAmount;
            console.log("new balance after purchase", newBalance);
            const { data: updateData, error: updateError } = await supabase
                .from('users')
                .update({ balance: newBalance })
                .eq('id', userId);
            if (updateError) {
                console.error("Error updating speed booster:", updateError);
                return res.status(500).json({ success: false, message: 'Failed to update balance booster.' });
            }
            console.log("updateData", updateData);
        }

        res.status(200).json({
            success: true,
            message: 'Balance booster purchased successfully.',
        });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/buy-ghostBooster-admin', async (req, res) => {
    try {
        let { adminSessionToken, price, duration } = req.body;

        if (!adminSessionToken || !price || !duration) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input. Please provide sessionToken, price, and duration.'
            });
        }

        console.log("Request received:", { adminSessionToken, price, duration });

        // Handle session token formatting issue
        if (adminSessionToken.includes('#')) {
            adminSessionToken = adminSessionToken.split('#')[0];
        }

        const now = new Date();
        const validTo = new Date(now.getTime() + duration * 60 * 60 * 1000); // Add duration in hours
        const formatToPostgresTimestamp = (date) => {
            return date.toISOString().replace('T', ' ').replace('Z', '+00');
        };
        // Step 1: Retrieve the session data
        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('sessionToken', adminSessionToken)
            .single();

        if (sessionError || !sessionData) {
            console.error('Session not found or error retrieving session:', sessionError);
            return res.status(404).json({
                success: false,
                message: 'Session not found!',
            });
        }

        console.log("Session Data:", sessionData);

        const userId = sessionData.userId;

        if (!userId) {
            return res.status(404).json({
                success: false,
                message: 'User not found!',
            });
        }

        const boosterData = {
            duration: duration,
            price: price,
            boughtOn: formatToPostgresTimestamp(now),
            validTo: formatToPostgresTimestamp(validTo)
        };
        const updatedBoosters = [boosterData];

        const { error: updateError } = await supabase
            .from('users')
            .update({ ghostBoosters: updatedBoosters })
            .eq('id', userId);

        if (updateError) {
            console.error("Error updating speed booster:", updateError);
            return res.status(500).json({ success: false, message: 'Failed to update speed booster.' });
        }

        console.log("Ghost booster successfully added:", boosterData);

        res.status(200).json({
            success: true,
            message: 'Ghost booster purchased successfully.',
            booster: boosterData
        });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/buy-ghostBooster-user', async (req, res) => {
    try {
        let { userId, price, duration, tonPrice } = req.body;

        if (!userId || !price || !duration) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input. Please provide sessionToken, price, and duration.'
            });
        }
        console.log("Request received:", { userId, price, duration });

        const now = new Date();
        const validTo = new Date(now.getTime() + duration * 60 * 60 * 1000); // Add duration in hours
        const formatToPostgresTimestamp = (date) => {
            return date.toISOString().replace('T', ' ').replace('Z', '+00');
        };
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            console.error("Error querying Supabase:", userError);
            return res.status(404).json({ success: false, message: "User not found or error retrieving user" });
        }

        const prevBoosters = userData.boostersPurchased || []
        const boosterData = {
            duration: duration,
            price: price,
            boughtOn: formatToPostgresTimestamp(now),
            validTo: formatToPostgresTimestamp(validTo),
            tonPrice: tonPrice,
            type: "ghostBooster"
        };
        const allBoosters = [...prevBoosters, boosterData]
        const updatedBoosters = [boosterData];

        const { error: updateError } = await supabase
            .from('users')
            .update({ ghostBoosters: updatedBoosters, boostersPurchased: allBoosters })
            .eq('id', userId);

        if (updateError) {
            console.error("Error updating ghost booster:", updateError);
            return res.status(500).json({ success: false, message: 'Failed to update ghost booster.' });
        }

        console.log("Ghost booster successfully added:", boosterData);

        res.status(200).json({
            success: true,
            message: 'Ghost booster purchased successfully.',
            booster: boosterData
        });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/buy-coinBooster-admin', async (req, res) => {
    try {
        let { adminSessionToken, price, duration } = req.body;

        if (!adminSessionToken || !price || !duration) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input. Please provide adminSessionToken, price, and duration.'
            });
        }

        console.log("Request received:", { adminSessionToken, price, duration });
        if (adminSessionToken.includes('#')) {
            adminSessionToken = adminSessionToken.split('#')[0];
        }

        const now = new Date();
        const validTo = new Date(now.getTime() + duration * 60 * 60 * 1000);
        const formatToPostgresTimestamp = (date) => {
            return date.toISOString().replace('T', ' ').replace('Z', '+00');
        };
        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('sessionToken', adminSessionToken)
            .single();

        if (sessionError || !sessionData) {
            console.error('Session not found or error retrieving session:', sessionError);
            return res.status(404).json({
                success: false,
                message: 'Session not found!',
            });
        }
        console.log("Session Data:", sessionData);
        const userId = sessionData.userId;

        if (!userId) {
            return res.status(404).json({
                success: false,
                message: 'User not found!',
            });
        }
        const boosterData = {
            duration: duration,
            price: price,
            boughtOn: formatToPostgresTimestamp(now),
            validTo: formatToPostgresTimestamp(validTo)
        };
        const updatedBoosters = [boosterData];

        const { error: updateError } = await supabase
            .from('users')
            .update({ coinBoosters: updatedBoosters })
            .eq('id', userId);

        if (updateError) {
            console.error("Error updating speed booster:", updateError);
            return res.status(500).json({ success: false, message: 'Failed to update speed booster.' });
        }

        console.log("Coin booster successfully added:", boosterData);

        res.status(200).json({
            success: true,
            message: 'Coin booster purchased successfully.',
            booster: boosterData
        });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/buy-coinBooster-user', async (req, res) => {
    try {
        let { userId, price, duration, tonPrice } = req.body;

        if (!userId || !price || !duration) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input. Please provide userId, price, and duration.'
            });
        }

        console.log("Request received:", { userId, price, duration });

        const now = new Date();
        const validTo = new Date(now.getTime() + duration * 60 * 60 * 1000);
        const formatToPostgresTimestamp = (date) => {
            return date.toISOString().replace('T', ' ').replace('Z', '+00');
        };
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            console.error("Error querying Supabase:", userError);
            return res.status(404).json({ success: false, message: "User not found or error retrieving user" });
        }

        const prevBoosters = userData.boostersPurchased || []

        const boosterData = {
            duration: duration,
            price: price,
            boughtOn: formatToPostgresTimestamp(now),
            validTo: formatToPostgresTimestamp(validTo),
            tonPrice: tonPrice,
            type: "pointBooster"
        };
        const updatedBoosters = [boosterData];
        const allBoosters = [...prevBoosters, boosterData]
        const { error: updateError } = await supabase
            .from('users')
            .update({ coinBoosters: updatedBoosters, boostersPurchased: allBoosters })
            .eq('id', userId);

        if (updateError) {
            console.error("Error updating speed booster:", updateError);
            return res.status(500).json({ success: false, message: 'Failed to update speed booster.' });
        }

        console.log("Coin booster successfully added:", boosterData);

        res.status(200).json({
            success: true,
            message: 'Coin booster purchased successfully.',
            booster: boosterData
        });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

app.post('/api/acceptReferral', async (req, res) => {
    const { referrerId, referralId, referralPhotoURL, referralUserName } = req.body;
    console.log("referrerId", referrerId)
    console.log("referralId", referralId)
    console.log("referralPhotoURL", referralPhotoURL)
    console.log("referralUserName", referralUserName)
    if (!referrerId || !referralId || !referralPhotoURL || !referralUserName) {
        return res.status(400).json({ error: 'Referrer ID, Referral ID, and Photo URL are required' });
    }

    try {
        const { data: referrerData, error: referrerError } = await supabase
            .from('users')
            .select('id, referrals, userName')
            .eq('id', referrerId)
            .single();

        if (referrerError || !referrerData) {
            return res.status(404).json({ error: 'Referrer not found' });
        }
        console.log("referrerData", referrerData);
        const existingReferrals = referrerData.referrals || [];
        const referralExistsInReferrer = existingReferrals.some(referral => referral.referralId === referralId);

        if (referralExistsInReferrer) {
            return res.status(409).json({ error: 'Referral already exists in referrer\'s list' });
        }

        const { data: allUsers, error: usersError } = await supabase
            .from('users')
            .select('referrals')
            .neq('id', referrerId);

        if (usersError) {
            return res.status(500).json({ error: 'Failed to fetch users' });
        }

        const referralExistsInOthers = allUsers.some(user => {
            const referrals = user.referrals || [];
            return referrals.some(referral => referral.referralId === referralId);
        });

        if (referralExistsInOthers) {
            return res.status(409).json({ error: 'Referral ID already exists in another user\'s referrals list' });
        }

        const newReferralData = {
            referralId: referralId,
            referralPhotoURL: referralPhotoURL,
            referralUserName: referralUserName,
            isClaimed: false
        };

        const updatedReferrals = [...existingReferrals, newReferralData];

        const { error: updateReferrerError } = await supabase
            .from('users')
            .update({ referrals: updatedReferrals })
            .eq('id', referrerId);

        if (updateReferrerError) {
            return res.status(500).json({ error: 'Failed to update referrer\'s referrals' });
        }

        const { error: insertReferralError } = await supabase
            .from('users')
            .upsert([
                {
                    id: referralId,
                    profilePhoto: referralPhotoURL,
                    userName: referralUserName,
                    referrerId: referrerId
                }
            ], { onConflict: ['id'] });

        if (insertReferralError) {
            console.error("Supabase upsert error:", insertReferralError);
            return res.status(500).json({ error: 'Failed to insert or update referral user' });
        }
        console.log("referrerData.userName:", referrerData.userName);
        // ✅ Send referrer userName back to frontend for Unity
        return res.status(200).json({
            success: true,
            message: 'Referral accepted successfully!',
            referrerUserName: referrerData.userName || 'Unknown'
        });

    } catch (error) {
        console.error('Error accepting referral:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/claimReferralReward-user', async (req, res) => {
    const { userId, referralId } = req.body;

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('referrals, balance')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const updatedReferrals = (user.referrals || []).map(ref => {
            if (String(ref.referralId) === String(referralId)) {
                return { ...ref, isClaimed: true };
            }
            return ref;
        });
        console.log("updatedReferrals:", updatedReferrals)
        // Update balance (e.g., +100 points)
        const newBalance = (user.balance || 0) + 25000;

        const { error: updateError } = await supabase
            .from('users')
            .update({ referrals: updatedReferrals, balance: newBalance })
            .eq('id', userId);

        if (updateError) {
            return res.status(500).json({ success: false, message: "Failed to update user" });
        }

        return res.json({
            success: true,
            message: "Referral reward claimed",
            newBalance
        });

    } catch (err) {
        console.error("Server error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});






app.get('/api/checkReferrer', async (req, res) => {
    const { telegramUserId } = req.query;

    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', telegramUserId)
            .single();

        if (error) {
            console.error("Error querying Supabase:", error);
            return res.status(500).json({ success: false, message: "Error querying the database" });
        }

        if (!data) {
            console.log("No user found with the given Telegram User ID.");
            return res.status(404).json({ success: false, message: "User not found" });
        }

        return res.status(200).json({
            success: true,
            exists: true,
            userName: data.userName,
            profilePhoto: data.profilePhoto,
            referralsCount: data.referrals.length,
            referrals: data.referrals
        });

    } catch (err) {
        console.error("Server error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});


app.get('/api/checkReferrals', async (req, res) => {
    const { telegramUserId } = req.query;

    try {
        // Step 1: Fetch user referrals
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('referrals')
            .eq('id', telegramUserId)
            .single();

        if (userError || !userData) {
            console.error("Error querying Supabase:", userError);
            return res.status(404).json({ success: false, message: "User not found or error retrieving user" });
        }

        const referrals = userData.referrals || [];
        console.log("referrals:", referrals);
        const referralIds = referrals.map(ref => ref.referralId);
        console.log("referralIds:", referralIds);
        if (referralIds.length === 0) {
            return res.status(200).json({ success: true, referrals: [] });
        }

        // Step 2: Fetch levelProgress for each referral user
        const { data: referralUsers, error: referralUsersError } = await supabase
            .from('users')
            .select('id, levelProgress')
            .in('id', referralIds);

        if (referralUsersError) {
            console.error("Error fetching referral users:", referralUsersError);
            return res.status(500).json({ success: false, message: "Failed to fetch referral user data" });
        }

        // Step 3: Combine referral data with levelProgress and nextIncompleteLevelId
        const enrichedReferrals = referrals.map(ref => {
            const referralIdNumber = Number(ref.referralId);  // 👈 Cast to number
            const matchedUser = referralUsers.find(user => user.id === referralIdNumber);
            //console.log("matchedUser:", matchedUser);

            const levelProgress = matchedUser?.levelProgress || [];
            const nextIncompleteLevel = levelProgress.find(level => level.isC === false);
            const levelsCleared = nextIncompleteLevel ? nextIncompleteLevel.id - 1 : null;
            console.log("levelsCleared:", levelsCleared);
            return {
                ...ref,
                levelsCleared
            };
        });
        console.log("referrals: ", enrichedReferrals)
        return res.status(200).json({
            success: true,
            referrals: enrichedReferrals
        });

    } catch (err) {
        console.error("Server error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});




app.get('/api/toncoin-price', async (req, res) => {

    const options = {
        method: 'GET',
        headers: { accept: 'application/json', 'x-cg-demo-api-key': 'CG-3qkmGTgTWXenAouD9JshQYt6' }
    };
    try {
        const response = await axios.get(
            'https://api.coingecko.com/api/v3/coins/the-open-network', options,
        );

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching CoinGecko data:', error);
        res.status(500).json({ error: 'Failed to fetch data from CoinGecko' });
    }
});

app.get("/api/callback/:provider", async (req, res) => {
    const { provider } = req.params;
    const code = req.query.code;

    if (!code) {
        return res.status(400).json({ error: "Authorization code missing" });
    }

    try {
        let tokenEndpoint = "";
        let redirectUri = "https://crush-server.vercel.app/api/callback/" + provider;

        if (provider === "google") {
            tokenEndpoint = "https://oauth2.googleapis.com/token";
        } else if (provider === "github") {
            tokenEndpoint = "https://github.com/login/oauth/access_token";
        } else if (provider === "discord") {
            tokenEndpoint = "https://discord.com/api/oauth2/token";
        }

        const response = await axios.post(tokenEndpoint, qs.stringify({
            code: code,
            client_id: provider === "google" ? "YOUR_GOOGLE_CLIENT_ID" :
                provider === "github" ? "Ov23lib06GxbLKfPbiQC" :
                    "1318977679072165971",
            client_secret: provider === "google" ? "YOUR_GOOGLE_CLIENT_SECRET" :
                provider === "github" ? "1620b0944cc0b813de406da2c21b124c82e04d4a" :
                    "be9db847b30bc281c348dfe5c3aafc0c5b6d10fe926ff735be80044cd7589c44",
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
        }), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        const accessToken = response.data.access_token;


        const { data, error } = await supabase.auth.api.getUser(accessToken);

        if (error) {
            return res.status(500).json({ error: error.message });
        }


        res.json({ user: data });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post("/api/auth/telegram", async (req, res) => {
    const { body } = req;

    console.log("Incoming request body:", body);

    if (!checkTelegramAuth(body)) {
        console.log("Invalid Telegram authentication data.");
        return res.status(401).json({ error: "Invalid authentication data." });
    }

    try {
        const { id, first_name, last_name, username, photo_url } = body;

        console.log("Login data received:", body);

        const { data: existingUser, error: fetchError } = await supabase
            .from("users")
            .select("*")
            .eq("id", id)
            .single();

        if (fetchError && fetchError.code === "PGRST116") {
            console.log("No existing user found, creating a new one.");

            const { data: newUser, error: insertError } = await supabase
                .from("users")
                .insert([
                    {
                        id,
                        first_name,
                        last_name,
                        username,
                        photo_url,
                    },
                ])
                .select()
                .single();

            if (insertError) {
                console.error("Error inserting user:", insertError.message);
                return res.status(500).json({ error: "Database insert error." });
            }

            console.log("New user inserted:", newUser);
        } else if (fetchError) {
            console.error("Error fetching user:", fetchError.message);
            return res.status(500).json({ error: "Database fetch error." });
        } else {
            console.log("User already exists:", existingUser);
        }

        console.log("Attempting to log user login...");
        const now = new Date().getTime();
        const { data: logData, error: logInsertError } = await supabase
            .from("user_logins")
            .insert([
                {
                    id: now,
                    userId: id,
                    first_name,
                    last_name,
                    username,
                    photo_url,
                },
            ]);

        if (logInsertError) {
            console.error("Error logging user login:", logInsertError.message);
        } else {
            console.log("User login logged successfully:", logData);
        }

        const sessionToken = crypto.randomBytes(32).toString("hex");
        console.log("Session token generated:", sessionToken);

        res.json({
            ok: true,
            user: {
                id,
                first_name,
                last_name,
                username,
                photo_url,
            },
            token: sessionToken,
        });

        console.log("Response successfully sent.");
    } catch (err) {
        console.error("Error during user authentication:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});






// Endpoint to fetch user's profile image
app.get("/api/auth/telegram/fetchImage", async (req, res) => {
    const imageUrl = req.query.url;

    if (!imageUrl) {
        return res.status(400).json({ error: "Image URL is required." });
    }

    console.log("Fetching image for URL:", imageUrl);

    try {
        const response = await axios({
            url: imageUrl,
            method: "GET",
            responseType: "arraybuffer",
        });

        res.set("Access-Control-Allow-Origin", "*");
        res.set("Content-Type", response.headers["content-type"]);
        res.send(response.data);
        console.log("Image fetched successfully.");
    } catch (error) {
        console.error("Error fetching image:", error.message);
        res.status(500).json({ error: "Error fetching image." });
    }
});

module.exports = app;
module.exports.handler = serverless(app);
