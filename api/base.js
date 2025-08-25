
const express = require('express');
const axios = require('axios');
const { createPublicClient, createWalletClient, http, parseEther, formatEther, parseUnits, formatUnits } = require('viem');
const { base } = require('viem/chains');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Initialize Supabase
const supabaseUrl = 'https://vyfqtqvhonepjjwfqgfb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5ZnF0cXZob25lcGpqd2ZxZ2ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkyODM1MTksImV4cCI6MjA1NDg1OTUxOX0.CLOUrX54KDcBjCFGBfZbRpTDrv0ImMrFMca-22AwwZc';
const supabase = createClient(supabaseUrl, supabaseKey);

// Base network configuration
const BASE_RPC_URL = 'https://mainnet.base.org';
const PCTN_TOKEN_ADDRESS = '0x742d35Cc6634C0532925a3b8D39C9fC7F3f8A81F'; // Example PCTN token address
const GAME_TREASURY_ADDRESS = '0x1234567890123456789012345678901234567890'; // Game treasury wallet

// ERC20 ABI for PCTN token
const ERC20_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function"
    }
];

const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL)
});

// Get Base network status
router.get('/base/status', async (req, res) => {
    try {
        const blockNumber = await publicClient.getBlockNumber();
        const gasPrice = await publicClient.getGasPrice();
        
        res.json({
            success: true,
            network: 'Base Mainnet',
            chainId: base.id,
            blockNumber: blockNumber.toString(),
            gasPrice: formatEther(gasPrice),
            rpcUrl: BASE_RPC_URL,
            pctnTokenAddress: PCTN_TOKEN_ADDRESS
        });
    } catch (error) {
        console.error('Base status error:', error);
        res.status(500).json({ error: 'Failed to get Base network status' });
    }
});

// Get PCTN token balance for an address
router.get('/base/balance/:address', async (req, res) => {
    const { address } = req.params;
    
    if (!address) {
        return res.status(400).json({ error: 'Address is required' });
    }
    
    try {
        // Get ETH balance
        const ethBalance = await publicClient.getBalance({
            address: address
        });
        
        // Get PCTN token balance
        const pctnBalance = await publicClient.readContract({
            address: PCTN_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address]
        });
        
        const decimals = await publicClient.readContract({
            address: PCTN_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'decimals'
        });
        
        res.json({
            success: true,
            address,
            ethBalance: formatEther(ethBalance),
            pctnBalance: formatUnits(pctnBalance, decimals),
            pctnBalanceRaw: pctnBalance.toString()
        });
    } catch (error) {
        console.error('Balance check error:', error);
        res.status(500).json({ error: 'Failed to get balance' });
    }
});

// Verify Base wallet signature
router.post('/base/verify-wallet', async (req, res) => {
    const { address, signature, message } = req.body;
    
    if (!address || !signature || !message) {
        return res.status(400).json({ error: 'Address, signature, and message are required' });
    }
    
    try {
        const isValid = await publicClient.verifyMessage({
            address,
            message,
            signature
        });
        
        if (isValid) {
            res.json({
                success: true,
                verified: true,
                address,
                message: 'Wallet verified successfully'
            });
        } else {
            res.status(400).json({ error: 'Invalid signature' });
        }
    } catch (error) {
        console.error('Wallet verification error:', error);
        res.status(500).json({ error: 'Failed to verify wallet' });
    }
});

// Connect Base wallet and update user profile
router.post('/base/connect-wallet', async (req, res) => {
    const { userId, address, signature, message } = req.body;
    
    if (!userId || !address || !signature || !message) {
        return res.status(400).json({ error: 'userId, address, signature, and message are required' });
    }
    
    try {
        // Verify the signature first
        const isValid = await publicClient.verifyMessage({
            address,
            message,
            signature
        });
        
        if (!isValid) {
            return res.status(400).json({ error: 'Invalid wallet signature' });
        }
        
        // Update user's wallet address in database
        const { error: updateError } = await supabase
            .from('users')
            .update({ 
                walletAddress: address,
                preferredWallet: 'base',
                walletConnectedAt: new Date().toISOString()
            })
            .eq('id', userId);
        
        if (updateError) {
            throw updateError;
        }
        
        // Get current PCTN balance
        const pctnBalance = await publicClient.readContract({
            address: PCTN_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address]
        });
        
        const decimals = await publicClient.readContract({
            address: PCTN_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'decimals'
        });
        
        res.json({
            success: true,
            message: 'Wallet connected successfully',
            address,
            pctnBalance: formatUnits(pctnBalance, decimals),
            preferredWallet: 'base'
        });
    } catch (error) {
        console.error('Wallet connection error:', error);
        res.status(500).json({ error: 'Failed to connect wallet' });
    }
});

// Token distribution endpoint (requires admin privileges)
router.post('/base/distribute-tokens', async (req, res) => {
    const { userId, address, amount, adminKey } = req.body;
    
    if (!userId || !address || !amount) {
        return res.status(400).json({ error: 'userId, address, and amount are required' });
    }
    
    // Simple admin check (in production, use proper authentication)
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    try {
        // In a real implementation, this would use a relayer service or multisig wallet
        // For now, we'll simulate the transaction and update the database
        
        const amountInTokens = parseUnits(amount.toString(), 18); // Assuming 18 decimals
        
        // Update user's in-game balance (this represents pending tokens to be distributed)
        const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (fetchError || !userData) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const pendingTokens = (userData.pendingTokens || 0) + parseInt(amount);
        
        const { error: updateError } = await supabase
            .from('users')
            .update({ 
                pendingTokens,
                lastTokenDistribution: new Date().toISOString()
            })
            .eq('id', userId);
        
        if (updateError) {
            throw updateError;
        }
        
        res.json({
            success: true,
            message: 'Token distribution queued',
            address,
            amount,
            pendingTokens,
            // In production, this would be a real transaction hash
            transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`
        });
    } catch (error) {
        console.error('Token distribution error:', error);
        res.status(500).json({ error: 'Failed to distribute tokens' });
    }
});

// Get Base transaction history for an address
router.get('/base/transactions/:address', async (req, res) => {
    const { address } = req.params;
    
    try {
        // In a real implementation, you would use Base's API or a service like Moralis
        // For now, we'll return mock data
        
        const mockTransactions = [
            {
                hash: '0x123...',
                type: 'PCTN Transfer',
                amount: '1000',
                from: GAME_TREASURY_ADDRESS,
                to: address,
                timestamp: new Date().toISOString(),
                status: 'confirmed'
            }
        ];
        
        res.json({
            success: true,
            address,
            transactions: mockTransactions
        });
    } catch (error) {
        console.error('Transaction history error:', error);
        res.status(500).json({ error: 'Failed to get transaction history' });
    }
});

// Estimate gas for PCTN token transfer
router.post('/base/estimate-gas', async (req, res) => {
    const { from, to, amount } = req.body;
    
    if (!from || !to || !amount) {
        return res.status(400).json({ error: 'from, to, and amount are required' });
    }
    
    try {
        const amountInTokens = parseUnits(amount.toString(), 18);
        
        // Estimate gas for token transfer
        const gasEstimate = await publicClient.estimateContractGas({
            address: PCTN_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [to, amountInTokens],
            account: from
        });
        
        const gasPrice = await publicClient.getGasPrice();
        const estimatedCost = gasEstimate * gasPrice;
        
        res.json({
            success: true,
            gasEstimate: gasEstimate.toString(),
            gasPrice: formatEther(gasPrice),
            estimatedCost: formatEther(estimatedCost),
            estimatedCostUSD: '~$0.05' // Mock USD conversion
        });
    } catch (error) {
        console.error('Gas estimation error:', error);
        res.status(500).json({ error: 'Failed to estimate gas' });
    }
});

// Get user's Base wallet info
router.get('/base/wallet-info/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const { data: userData, error } = await supabase
            .from('users')
            .select('walletAddress, preferredWallet, pendingTokens, walletConnectedAt')
            .eq('id', userId)
            .single();
        
        if (error || !userData) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        let walletData = {
            connected: !!userData.walletAddress,
            address: userData.walletAddress,
            preferredWallet: userData.preferredWallet,
            pendingTokens: userData.pendingTokens || 0,
            connectedAt: userData.walletConnectedAt
        };
        
        // If wallet is connected, get live balance
        if (userData.walletAddress) {
            try {
                const pctnBalance = await publicClient.readContract({
                    address: PCTN_TOKEN_ADDRESS,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [userData.walletAddress]
                });
                
                const decimals = await publicClient.readContract({
                    address: PCTN_TOKEN_ADDRESS,
                    abi: ERC20_ABI,
                    functionName: 'decimals'
                });
                
                walletData.pctnBalance = formatUnits(pctnBalance, decimals);
            } catch (balanceError) {
                console.error('Error fetching balance:', balanceError);
                walletData.pctnBalance = '0';
            }
        }
        
        res.json({
            success: true,
            wallet: walletData
        });
    } catch (error) {
        console.error('Wallet info error:', error);
        res.status(500).json({ error: 'Failed to get wallet info' });
    }
});

module.exports = router;
