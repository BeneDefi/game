
const express = require('express');
const { createPublicClient, http } = require('viem');
const { base } = require('viem/chains');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const router = express.Router();

// Initialize Supabase
const supabaseUrl = 'https://vyfqtqvhonepjjwfqgfb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5ZnF0cXZob25lcGpqd2ZxZ2ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkyODM1MTksImV4cCI6MjA1NDg1OTUxOX0.CLOUrX54KDcBjCFGBfZbRpTDrv0ImMrFMca-22AwwZc';
const supabase = createClient(supabaseUrl, supabaseKey);

const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org')
});

// Generate authentication message for wallet signing
router.post('/base-auth/generate-message', async (req, res) => {
    const { address, userId } = req.body;
    
    if (!address) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }
    
    try {
        const nonce = crypto.randomBytes(16).toString('hex');
        const timestamp = Date.now();
        
        const message = `Pacton Game Authentication
        
Please sign this message to verify your wallet ownership.

Wallet: ${address}
Nonce: ${nonce}
Timestamp: ${timestamp}
Action: Connect wallet to Pacton Game
Network: Base Mainnet

This request will not trigger any blockchain transaction or cost any gas fees.`;

        // Store the nonce temporarily (expires in 10 minutes)
        const { error: nonceError } = await supabase
            .from('auth_nonces')
            .upsert({
                address: address.toLowerCase(),
                nonce,
                userId,
                expiresAt: new Date(timestamp + 10 * 60 * 1000).toISOString(),
                createdAt: new Date().toISOString()
            });
        
        if (nonceError) {
            throw nonceError;
        }
        
        res.json({
            success: true,
            message,
            nonce,
            timestamp
        });
        
    } catch (error) {
        console.error('Generate message error:', error);
        res.status(500).json({ error: 'Failed to generate authentication message' });
    }
});

// Verify wallet signature and authenticate user
router.post('/base-auth/verify-signature', async (req, res) => {
    const { address, signature, message, userId, nonce } = req.body;
    
    if (!address || !signature || !message || !nonce) {
        return res.status(400).json({ error: 'Address, signature, message, and nonce are required' });
    }
    
    try {
        // Verify the nonce exists and hasn't expired
        const { data: nonceData, error: nonceError } = await supabase
            .from('auth_nonces')
            .select('*')
            .eq('address', address.toLowerCase())
            .eq('nonce', nonce)
            .gt('expiresAt', new Date().toISOString())
            .single();
        
        if (nonceError || !nonceData) {
            return res.status(400).json({ error: 'Invalid or expired nonce' });
        }
        
        // Verify the signature
        const isValid = await publicClient.verifyMessage({
            address: address,
            message: message,
            signature: signature
        });
        
        if (!isValid) {
            return res.status(400).json({ error: 'Invalid signature' });
        }
        
        // Create or update user with wallet connection
        let userData;
        
        if (userId) {
            // Update existing user
            const { data: updatedUser, error: updateError } = await supabase
                .from('users')
                .update({
                    walletAddress: address.toLowerCase(),
                    preferredWallet: 'base',
                    walletConnectedAt: new Date().toISOString(),
                    walletVerified: true
                })
                .eq('id', userId)
                .select()
                .single();
            
            if (updateError) {
                throw updateError;
            }
            
            userData = updatedUser;
        } else {
            // Create new wallet-only user
            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({
                    walletAddress: address.toLowerCase(),
                    preferredWallet: 'base',
                    walletConnectedAt: new Date().toISOString(),
                    walletVerified: true,
                    authProvider: 'base-wallet'
                })
                .select()
                .single();
            
            if (createError) {
                throw createError;
            }
            
            userData = newUser;
        }
        
        // Generate session token
        const sessionToken = `base_session_${userData.id}_${Date.now()}`;
        
        const { error: sessionError } = await supabase
            .from('sessions')
            .insert({
                sessionToken,
                userId: userData.id,
                authProvider: 'base-wallet',
                walletAddress: address.toLowerCase()
            });
        
        if (sessionError) {
            console.error('Session creation error:', sessionError);
        }
        
        // Clean up used nonce
        await supabase
            .from('auth_nonces')
            .delete()
            .eq('address', address.toLowerCase())
            .eq('nonce', nonce);
        
        res.json({
            success: true,
            user: userData,
            sessionToken,
            message: 'Wallet authenticated successfully'
        });
        
    } catch (error) {
        console.error('Signature verification error:', error);
        res.status(500).json({ error: 'Failed to verify signature' });
    }
});

// Check wallet authentication status
router.get('/base-auth/status/:address', async (req, res) => {
    const { address } = req.params;
    
    try {
        const { data: userData, error } = await supabase
            .from('users')
            .select('id, walletAddress, preferredWallet, walletVerified, walletConnectedAt, balance')
            .eq('walletAddress', address.toLowerCase())
            .single();
        
        if (error || !userData) {
            return res.json({
                authenticated: false,
                message: 'Wallet not connected'
            });
        }
        
        res.json({
            authenticated: true,
            user: userData,
            message: 'Wallet is authenticated'
        });
        
    } catch (error) {
        console.error('Auth status error:', error);
        res.status(500).json({ error: 'Failed to check authentication status' });
    }
});

// Disconnect wallet
router.post('/base-auth/disconnect', async (req, res) => {
    const { userId, sessionToken } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    
    try {
        // Update user to disconnect wallet
        const { error: updateError } = await supabase
            .from('users')
            .update({
                walletAddress: null,
                preferredWallet: null,
                walletVerified: false
            })
            .eq('id', userId);
        
        if (updateError) {
            throw updateError;
        }
        
        // Invalidate session if provided
        if (sessionToken) {
            await supabase
                .from('sessions')
                .delete()
                .eq('sessionToken', sessionToken);
        }
        
        res.json({
            success: true,
            message: 'Wallet disconnected successfully'
        });
        
    } catch (error) {
        console.error('Disconnect error:', error);
        res.status(500).json({ error: 'Failed to disconnect wallet' });
    }
});

module.exports = router;
