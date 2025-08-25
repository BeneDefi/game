
const axios = require('axios');
const crypto = require('crypto');

class FarcasterUtils {
    constructor(hubUrl = 'https://hub-api.neynar.com', apiKey = process.env.NEYNAR_API_KEY) {
        this.hubUrl = hubUrl;
        this.apiKey = apiKey;
    }

    // Verify Farcaster user
    async verifyUser(fid) {
        try {
            const response = await axios.get(`${this.hubUrl}/v2/user/bulk?fids=${fid}`, {
                headers: {
                    'accept': 'application/json',
                    'api_key': this.apiKey
                }
            });

            return response.data.users[0] || null;
        } catch (error) {
            console.error('Error verifying Farcaster user:', error);
            return null;
        }
    }

    // Get user's casts
    async getUserCasts(fid, limit = 25) {
        try {
            const response = await axios.get(`${this.hubUrl}/v2/casts?fid=${fid}&limit=${limit}`, {
                headers: {
                    'accept': 'application/json',
                    'api_key': this.apiKey
                }
            });

            return response.data.casts || [];
        } catch (error) {
            console.error('Error getting user casts:', error);
            return [];
        }
    }

    // Validate frame signature
    validateFrameSignature(body, signature, secret) {
        if (!signature || !secret) return false;
        
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(body))
            .digest('hex');
        
        return signature === `sha256=${expectedSignature}`;
    }

    // Generate frame metadata
    generateFrameMetadata(options) {
        const {
            title = 'Pacton Game',
            image,
            buttons = [],
            postUrl,
            inputText = null,
            aspectRatio = '1.91:1'
        } = options;

        let metadata = `
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${image}" />
    <meta property="fc:frame:image:aspect_ratio" content="${aspectRatio}" />
    <meta property="fc:frame:post_url" content="${postUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:image" content="${image}" />`;

        if (inputText) {
            metadata += `\n    <meta property="fc:frame:input:text" content="${inputText}" />`;
        }

        buttons.forEach((button, index) => {
            const buttonNumber = index + 1;
            if (typeof button === 'string') {
                metadata += `\n    <meta property="fc:frame:button:${buttonNumber}" content="${button}" />`;
            } else {
                metadata += `\n    <meta property="fc:frame:button:${buttonNumber}" content="${button.text}" />`;
                if (button.action) {
                    metadata += `\n    <meta property="fc:frame:button:${buttonNumber}:action" content="${button.action}" />`;
                }
                if (button.target) {
                    metadata += `\n    <meta property="fc:frame:button:${buttonNumber}:target" content="${button.target}" />`;
                }
            }
        });

        return metadata;
    }

    // Create frame response
    createFrameResponse(options) {
        const metadata = this.generateFrameMetadata(options);
        
        return `
<!DOCTYPE html>
<html>
<head>
    <title>${options.title || 'Pacton Game'}</title>
    ${metadata}
</head>
<body>
    ${options.body || '<h1>Pacton Game Frame</h1>'}
</body>
</html>`;
    }
}

module.exports = FarcasterUtils;
