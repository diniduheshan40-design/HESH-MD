const fetch = require('node-fetch');
const gifted = require('gifted-dls');

module.exports = {
    name: 'video',
    async execute(sock, msg, args, sender) {
        const query = args.join(' ');
        if (!query) {
            return await sock.sendMessage(sender, { 
                text: "🎥 *YouTube Video Downloader*\n\n*Usage:* .video <Video Name>\n*Example:* .video sadu kare\n\n🔍 Please provide a video name to search." 
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(sender, { text: `🔍 *Searching for "${query}"...* Please wait...` }, { quoted: msg });

            // YouTube Search කිරීම
            const searchResults = await gifted.giftedyts(query);
            if (!searchResults || searchResults.length === 0) {
                return await sock.sendMessage(sender, { text: `❌ *No Results Found!*\n\nNo videos found for: *${query}*.\nPlease try a different search term.` }, { quoted: msg });
            }

            const video = searchResults[0];
            const { title, url, thumbnail, duration, views, author } = video;

            // Thumbnail එක සහ Video විස්තර යැවීම
            await sock.sendMessage(sender, {
                image: { url: thumbnail },
                caption: `🎥 *Title:* ${title}\n` +
                         `⏱️ *Duration:* ${duration.timestamp}\n` +
                         `👀 *Views:* ${views.toLocaleString()}\n` +
                         `👤 *Author:* ${author.name}\n\n` +
                         `🔗 *YouTube URL:* ${url}\n\n` +
                         `⬇️ *Downloading video...* Please wait...`
            }, { quoted: msg });

            // Download API එකෙන් MP4 link එක ගැනීම
            const apiUrl = `https://apis.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(url)}`;
            const res = await fetch(apiUrl);
            const data = await res.json();

            if (!data.success || data.status !== 200) {
                return await sock.sendMessage(sender, { 
                    text: `❌ *Error!*\n\nUnable to fetch video for: *${title}*.\n*Reason:* ${data.message || 'API error'}\n\nPlease try again later.` 
                }, { quoted: msg });
            }

            // Video එක යැවීම
            await sock.sendMessage(sender, {
                video: { url: data.result.download_url },
                mimetype: 'video/mp4',
                fileName: `${title}.mp4`,
                caption: `✅ *Download Complete!*\n\n🎥 *Title:* ${title}\n🔗 *URL:* ${url}\n\nEnjoy your video! 🎬`
            }, { quoted: msg });

        } catch (error) {
            console.error('Error in video command:', error);
            await sock.sendMessage(sender, { 
                text: `❌ *Error!*\n\nWe encountered an error while processing your request.\n*Reason:* ${error.message}\n\nPlease try again later.` 
            }, { quoted: msg });
        }
    }
};

