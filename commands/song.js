const fetch = require('node-fetch');
const gifted = require('gifted-dls');

module.exports = {
    name: 'song',
    async execute(sock, msg, args, sender) {
        const query = args.join(' ');
        if (!query) {
            return await sock.sendMessage(sender, { 
                text: "🎵 *YouTube Audio Downloader*\n\n*Usage:* .song <Song Name>\n*Example:* .song sadu kare\n\n🔍 Please provide a song name to search." 
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
                caption: `🎵 *Title:* ${title}\n` +
                         `⏱️ *Duration:* ${duration.timestamp}\n` +
                         `👀 *Views:* ${views.toLocaleString()}\n` +
                         `👤 *Author:* ${author.name}\n\n` +
                         `🔗 *YouTube URL:* ${url}\n\n` +
                         `⬇️ *Downloading audio...* Please wait...`
            }, { quoted: msg });

            // Download API එකෙන් MP3 link එක ගැනීම
            const apiUrl = `https://apis.davidcyriltech.my.id/youtube/mp3?url=${encodeURIComponent(url)}`;
            const res = await fetch(apiUrl);
            const data = await res.json();

            if (!data.success || data.status !== 200) {
                return await sock.sendMessage(sender, { 
                    text: `❌ *Error!*\n\nUnable to fetch audio for: *${title}*.\n*Reason:* ${data.message || 'API error'}\n\nPlease try again later.` 
                }, { quoted: msg });
            }

            // Audio එක යැවීම
            await sock.sendMessage(sender, {
                audio: { url: data.result.downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`,
                caption: `✅ *Download Complete!*\n\n🎵 *Title:* ${title}\n🔗 *URL:* ${url}\n\nEnjoy your audio! 🎧`
            }, { quoted: msg });

        } catch (error) {
            console.error('Error in song command:', error);
            await sock.sendMessage(sender, { 
                text: `❌ *Error!*\n\nWe encountered an error while processing your request.\n*Reason:* ${error.message}\n\nPlease try again later.` 
            }, { quoted: msg });
        }
    }
};

