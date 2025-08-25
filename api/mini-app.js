
const express = require('express');
const FarcasterUtils = require('./farcaster-utils');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const farcasterUtils = new FarcasterUtils();

// Initialize Supabase (reuse from main file)
const supabaseUrl = 'https://vyfqtqvhonepjjwfqgfb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5ZnF0cXZob25lcGpqd2ZxZ2ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkyODM1MTksImV4cCI6MjA1NDg1OTUxOX0.CLOUrX54KDcBjCFGBfZbRpTDrv0ImMrFMca-22AwwZc';
const supabase = createClient(supabaseUrl, supabaseKey);

// Mini app authentication for Farcaster users
router.post('/mini-app/auth/farcaster', async (req, res) => {
    const { fid, username, displayName, pfpUrl, verifications } = req.body;
    
    if (!fid) {
        return res.status(400).json({ error: 'FID is required' });
    }
    
    try {
        // Verify user with Farcaster API
        const farcasterUser = await farcasterUtils.verifyUser(fid);
        
        if (!farcasterUser) {
            return res.status(404).json({ error: 'Farcaster user not found' });
        }
        
        // Check if user exists in our database
        const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', fid)
            .single();
        
        let userData;
        
        if (!existingUser) {
            // Create new user
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert({
                    id: fid,
                    userName: username || farcasterUser.username,
                    firstName: displayName || farcasterUser.display_name,
                    profilePhoto: pfpUrl || farcasterUser.pfp_url,
                    referralLink: `https://warpcast.com/~/compose?text=Play Pacton Game and earn PCTN tokens! &embeds[]=https://your-repl-url.replit.dev/api/frame`,
                    authProvider: 'farcaster',
                    farcasterVerifications: verifications
                })
                .select()
                .single();
            
            if (insertError) {
                console.error('Error creating user:', insertError);
                return res.status(500).json({ error: 'Failed to create user' });
            }
            
            userData = newUser;
        } else {
            // Update existing user
            const { data: updatedUser, error: updateError } = await supabase
                .from('users')
                .update({
                    userName: username || existingUser.userName,
                    firstName: displayName || existingUser.firstName,
                    profilePhoto: pfpUrl || existingUser.profilePhoto,
                    farcasterVerifications: verifications
                })
                .eq('id', fid)
                .select()
                .single();
            
            if (updateError) {
                console.error('Error updating user:', updateError);
                return res.status(500).json({ error: 'Failed to update user' });
            }
            
            userData = updatedUser;
        }
        
        // Create session token
        const sessionToken = `fc_session_${fid}_${Date.now()}`;
        
        const { error: sessionError } = await supabase
            .from('sessions')
            .insert({
                sessionToken,
                userId: fid,
                firstName: userData.firstName,
                lastName: userData.lastName,
                userName: userData.userName,
                profilePhoto: userData.profilePhoto
            });
        
        if (sessionError) {
            console.error('Error creating session:', sessionError);
            return res.status(500).json({ error: 'Failed to create session' });
        }
        
        res.json({
            success: true,
            user: userData,
            sessionToken,
            authProvider: 'farcaster'
        });
        
    } catch (error) {
        console.error('Farcaster auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// Mini app leaderboard for frames
router.get('/mini-app/leaderboard', async (req, res) => {
    try {
        const { data: topUsers, error } = await supabase
            .from('users')
            .select('id, userName, firstName, balance, profilePhoto')
            .order('balance', { ascending: false })
            .limit(10);
        
        if (error) {
            console.error('Error fetching leaderboard:', error);
            return res.status(500).json({ error: 'Failed to fetch leaderboard' });
        }
        
        const leaderboardText = topUsers
            .map((user, index) => `${index + 1}. ${user.userName || user.firstName || 'Anonymous'}: ${user.balance || 0} PCTN`)
            .join('\n');
        
        res.json({
            success: true,
            topUsers,
            leaderboardText
        });
        
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mini app game stats
router.get('/mini-app/stats/:fid', async (req, res) => {
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
        
        const stats = {
            balance: user.balance || 0,
            pelletsEaten: user.pelletsEaten || 0,
            powerPelletsEaten: user.powerPelletsEaten || 0,
            ghostsEaten: user.ghostsEaten || 0,
            referrals: (user.referrals || []).length,
            rank: 0 // TODO: Calculate actual rank
        };
        
        res.json({
            success: true,
            stats,
            user: {
                id: user.id,
                userName: user.userName,
                firstName: user.firstName,
                profilePhoto: user.profilePhoto
            }
        });
        
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Share achievement to Farcaster
router.post('/mini-app/share-achievement', async (req, res) => {
    const { fid, achievement, score } = req.body;
    
    if (!fid || !achievement) {
        return res.status(400).json({ error: 'FID and achievement are required' });
    }
    
    try {
        const shareText = `🎮 Just achieved ${achievement} in Pacton Game! Score: ${score} PCTN\n\nPlay now: https://your-repl-url.replit.dev/api/frame`;
        
        res.json({
            success: true,
            shareText,
            shareUrl: `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`
        });
        
    } catch (error) {
        console.error('Share error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
