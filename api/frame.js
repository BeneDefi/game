
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const FarcasterUtils = require('./farcaster-utils');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Initialize utilities
const farcasterUtils = new FarcasterUtils();

// Initialize Supabase
const supabaseUrl = 'https://vyfqtqvhonepjjwfqgfb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5ZnF0cXZob25lcGpqd2ZxZ2ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkyODM1MTksImV4cCI6MjA1NDg1OTUxOX0.CLOUrX54KDcBjCFGBfZbRpTDrv0ImMrFMca-22AwwZc';
const supabase = createClient(supabaseUrl, supabaseKey);

// Main frame route - Game landing page
router.get('/frame', (req, res) => {
    const frameHtml = farcasterUtils.createFrameResponse({
        title: 'Pacton Game - Play & Earn PCTN on Base',
        image: 'https://pacton-11.vercel.app/frame-game-landing.jpg',
        buttons: [
            'Play Game 🎮',
            'Leaderboard 🏆', 
            'Connect Wallet 💰',
            'About PCTN 🪙'
        ],
        postUrl: `${process.env.REPL_URL || 'https://your-repl-url.replit.dev'}/api/frame/action`,
        body: `
            <div style="text-align: center; padding: 20px;">
                <h1>🎮 Pacton Game</h1>
                <p>Play the classic Pac-Man style game and earn PCTN tokens on Base blockchain!</p>
                <p>🏆 Compete with players worldwide</p>
                <p>💰 Earn real PCTN tokens for achievements</p>
                <p>🔗 Connect your Base wallet to claim rewards</p>
            </div>
        `
    });
    
    res.setHeader('Content-Type', 'text/html');
    res.send(frameHtml);
});

// Frame action handler with Base integration
router.post('/frame/action', async (req, res) => {
    const { untrustedData, trustedData } = req.body;
    
    try {
        // Extract user data from frame
        const buttonIndex = untrustedData?.buttonIndex || 1;
        const fid = untrustedData?.fid;
        const inputText = untrustedData?.inputText || '';
        
        console.log('Frame action:', { buttonIndex, fid, inputText });
        
        let responseHtml;
        
        switch (buttonIndex) {
            case 1: // Play Game
                // Check if user exists, create if not
                let userData = null;
                if (fid) {
                    const { data: existingUser } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', fid)
                        .single();
                    
                    if (!existingUser) {
                        // Get Farcaster user info
                        const farcasterUser = await farcasterUtils.verifyUser(fid);
                        
                        if (farcasterUser) {
                            const { data: newUser } = await supabase
                                .from('users')
                                .insert({
                                    id: fid,
                                    userName: farcasterUser.username,
                                    firstName: farcasterUser.display_name,
                                    profilePhoto: farcasterUser.pfp_url,
                                    authProvider: 'farcaster'
                                })
                                .select()
                                .single();
                            userData = newUser;
                        }
                    } else {
                        userData = existingUser;
                    }
                }
                
                responseHtml = farcasterUtils.createFrameResponse({
                    title: 'Starting Pacton Game...',
                    image: 'https://pacton-11.vercel.app/frame-game-start.jpg',
                    buttons: [
                        { text: 'Play Now 🎮', action: 'link', target: `https://pacton-11.vercel.app/?fid=${fid}` },
                        'Back to Menu 🔙'
                    ],
                    postUrl: `${process.env.REPL_URL || 'https://your-repl-url.replit.dev'}/api/frame`,
                    body: `
                        <div style="text-align: center; padding: 20px;">
                            <h2>🎮 Ready to Play!</h2>
                            <p>Welcome${userData?.userName ? `, ${userData.userName}` : ''}!</p>
                            <p>Click "Play Now" to start earning PCTN tokens</p>
                            <p>💡 Tip: Connect your Base wallet after playing to claim rewards!</p>
                        </div>
                    `
                });
                break;
                
            case 2: // Leaderboard
                try {
                    const { data: topUsers } = await supabase
                        .from('users')
                        .select('userName, firstName, balance, profilePhoto')
                        .order('balance', { ascending: false })
                        .limit(5);
                    
                    const leaderboardText = topUsers
                        .map((user, index) => `${index + 1}. ${user.userName || user.firstName || 'Anonymous'}: ${user.balance || 0} PCTN`)
                        .join('\\n');
                    
                    responseHtml = farcasterUtils.createFrameResponse({
                        title: 'Pacton Game Leaderboard',
                        image: 'https://pacton-11.vercel.app/frame-leaderboard.jpg',
                        buttons: [
                            'Play Game 🎮',
                            'My Stats 📊',
                            'Back to Menu 🔙'
                        ],
                        postUrl: `${process.env.REPL_URL || 'https://your-repl-url.replit.dev'}/api/frame/action`,
                        body: `
                            <div style="text-align: center; padding: 20px;">
                                <h2>🏆 Top Players</h2>
                                <div style="text-align: left; max-width: 400px; margin: 0 auto;">
                                    ${topUsers.map((user, index) => `
                                        <p>${index + 1}. ${user.userName || user.firstName || 'Anonymous'}: ${user.balance || 0} PCTN</p>
                                    `).join('')}
                                </div>
                                <p style="margin-top: 20px;">🎯 Play now to climb the ranks!</p>
                            </div>
                        `
                    });
                } catch (error) {
                    console.error('Leaderboard error:', error);
                    responseHtml = farcasterUtils.createFrameResponse({
                        title: 'Error Loading Leaderboard',
                        image: 'https://pacton-11.vercel.app/frame-error.jpg',
                        buttons: ['Back to Menu 🔙'],
                        postUrl: `${process.env.REPL_URL || 'https://your-repl-url.replit.dev'}/api/frame`
                    });
                }
                break;
                
            case 3: // Connect Wallet
                responseHtml = farcasterUtils.createFrameResponse({
                    title: 'Connect Base Wallet',
                    image: 'https://pacton-11.vercel.app/frame-wallet-connect.jpg',
                    buttons: [
                        { text: 'Connect Wallet 🔗', action: 'link', target: `https://pacton-11.vercel.app/wallet-connect?fid=${fid}` },
                        'Check Balance 💰',
                        'Back to Menu 🔙'
                    ],
                    postUrl: `${process.env.REPL_URL || 'https://your-repl-url.replit.dev'}/api/frame/action`,
                    inputText: 'Enter your Base wallet address (0x...)',
                    body: `
                        <div style="text-align: center; padding: 20px;">
                            <h2>💰 Connect Your Base Wallet</h2>
                            <p>Connect your Base wallet to:</p>
                            <ul style="text-align: left; max-width: 300px; margin: 0 auto;">
                                <li>✅ Claim your PCTN token rewards</li>
                                <li>🔄 Transfer tokens on Base network</li>
                                <li>📊 View your real-time balance</li>
                                <li>🎯 Participate in special events</li>
                            </ul>
                            <p style="margin-top: 20px;">FID: ${fid}</p>
                        </div>
                    `
                });
                break;
                
            case 4: // About PCTN
                responseHtml = farcasterUtils.createFrameResponse({
                    title: 'About PCTN Token',
                    image: 'https://pacton-11.vercel.app/frame-pctn-info.jpg',
                    buttons: [
                        { text: 'Buy PCTN 💰', action: 'link', target: 'https://app.uniswap.org/#/swap?chain=base' },
                        'Token Contract 📄',
                        'Back to Menu 🔙'
                    ],
                    postUrl: `${process.env.REPL_URL || 'https://your-repl-url.replit.dev'}/api/frame/action`,
                    body: `
                        <div style="text-align: center; padding: 20px;">
                            <h2>🪙 PCTN Token</h2>
                            <p><strong>Pacton Token (PCTN)</strong> is the native game token built on Base blockchain.</p>
                            <div style="text-align: left; max-width: 400px; margin: 0 auto;">
                                <h3>Key Features:</h3>
                                <ul>
                                    <li>🎮 Earned through gameplay</li>
                                    <li>🔄 Tradeable on Base DEXs</li>
                                    <li>🎁 Used for in-game purchases</li>
                                    <li>🏆 Staking rewards available</li>
                                </ul>
                                <h3>Network:</h3>
                                <p>Base (Ethereum L2)</p>
                                <h3>Contract:</h3>
                                <p style="font-size: 12px;">0x742d35Cc6634C0532925a3b8D39C9fC7F3f8A81F</p>
                            </div>
                        </div>
                    `
                });
                break;
                
            default:
                // Handle wallet address input or other actions
                if (inputText && inputText.startsWith('0x')) {
                    // User entered wallet address
                    try {
                        // Verify it's a valid address and get balance
                        const balanceResponse = await axios.get(`${process.env.REPL_URL || 'https://your-repl-url.replit.dev'}/api/base/balance/${inputText}`);
                        const { ethBalance, pctnBalance } = balanceResponse.data;
                        
                        responseHtml = farcasterUtils.createFrameResponse({
                            title: 'Wallet Balance',
                            image: 'https://pacton-11.vercel.app/frame-balance.jpg',
                            buttons: [
                                'Connect This Wallet 🔗',
                                'Check Another 🔍',
                                'Back to Menu 🔙'
                            ],
                            postUrl: `${process.env.REPL_URL || 'https://your-repl-url.replit.dev'}/api/frame/action`,
                            body: `
                                <div style="text-align: center; padding: 20px;">
                                    <h2>💰 Wallet Balance</h2>
                                    <p><strong>Address:</strong><br/>${inputText.substring(0, 6)}...${inputText.substring(38)}</p>
                                    <p><strong>ETH:</strong> ${parseFloat(ethBalance).toFixed(4)} ETH</p>
                                    <p><strong>PCTN:</strong> ${parseFloat(pctnBalance).toFixed(2)} PCTN</p>
                                    <p style="margin-top: 20px;">Connect this wallet to claim game rewards!</p>
                                </div>
                            `
                        });
                    } catch (error) {
                        responseHtml = farcasterUtils.createFrameResponse({
                            title: 'Invalid Address',
                            image: 'https://pacton-11.vercel.app/frame-error.jpg',
                            buttons: ['Try Again 🔄', 'Back to Menu 🔙'],
                            postUrl: `${process.env.REPL_URL || 'https://your-repl-url.replit.dev'}/api/frame/action`,
                            body: `
                                <div style="text-align: center; padding: 20px;">
                                    <h2>❌ Invalid Address</h2>
                                    <p>Please enter a valid Base wallet address starting with 0x</p>
                                </div>
                            `
                        });
                    }
                } else {
                    // Default back to main menu
                    responseHtml = farcasterUtils.createFrameResponse({
                        title: 'Pacton Game - Play & Earn PCTN on Base',
                        image: 'https://pacton-11.vercel.app/frame-game-landing.jpg',
                        buttons: [
                            'Play Game 🎮',
                            'Leaderboard 🏆', 
                            'Connect Wallet 💰',
                            'About PCTN 🪙'
                        ],
                        postUrl: `${process.env.REPL_URL || 'https://your-repl-url.replit.dev'}/api/frame/action`
                    });
                }
        }
        
        res.setHeader('Content-Type', 'text/html');
        res.send(responseHtml);
        
    } catch (error) {
        console.error('Frame action error:', error);
        
        const errorHtml = farcasterUtils.createFrameResponse({
            title: 'Error - Pacton Game',
            image: 'https://pacton-11.vercel.app/frame-error.jpg',
            buttons: ['Back to Menu 🔙'],
            postUrl: `${process.env.REPL_URL || 'https://your-repl-url.replit.dev'}/api/frame`,
            body: `
                <div style="text-align: center; padding: 20px;">
                    <h2>❌ Something went wrong</h2>
                    <p>Please try again or contact support</p>
                </div>
            `
        });
        
        res.setHeader('Content-Type', 'text/html');
        res.send(errorHtml);
    }
});

// Frame stats endpoint for specific user
router.get('/frame/stats/:fid', async (req, res) => {
    const { fid } = req.params;
    
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', fid)
            .single();
        
        if (error || !user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const statsHtml = farcasterUtils.createFrameResponse({
            title: `${user.userName || user.firstName}'s Stats`,
            image: 'https://pacton-11.vercel.app/frame-user-stats.jpg',
            buttons: [
                'Play Again 🎮',
                'Leaderboard 🏆',
                'Back to Menu 🔙'
            ],
            postUrl: `${process.env.REPL_URL || 'https://your-repl-url.replit.dev'}/api/frame/action`,
            body: `
                <div style="text-align: center; padding: 20px;">
                    <h2>📊 Your Game Stats</h2>
                    <p><strong>Player:</strong> ${user.userName || user.firstName}</p>
                    <p><strong>PCTN Balance:</strong> ${user.balance || 0}</p>
                    <p><strong>Pellets Eaten:</strong> ${user.pelletsEaten || 0}</p>
                    <p><strong>Power Pellets:</strong> ${user.powerPelletsEaten || 0}</p>
                    <p><strong>Ghosts Defeated:</strong> ${user.ghostsEaten || 0}</p>
                    <p><strong>Wallet:</strong> ${user.walletAddress ? 'Connected ✅' : 'Not Connected ❌'}</p>
                </div>
            `
        });
        
        res.setHeader('Content-Type', 'text/html');
        res.send(statsHtml);
        
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
