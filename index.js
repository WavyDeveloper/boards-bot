const fs = require("fs");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// ⚠️ Replace this with your actual bot token
const BOT_TOKEN = "YOUR_BOT_TOKEN_HERE";

// Channel & Role IDs
const WELCOME_CHANNEL_ID = "1341094923541418107";
const SOTD_CHANNEL_ID = "1341579652539486209";
const SOTD_PING_ROLE_ID = "1341592272629661828";
const REACTION_ROLES_CHANNEL_ID = "1341591536332177489";
const REACTION_ROLES_FILE = "reaction_roles.json";
const SOTD_FILE = "sotd.json";

// ✅ Prevents duplicate welcome messages
const recentJoins = new Set();

client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    sendSOTD();
    
    if (!fs.existsSync(REACTION_ROLES_FILE)) {
        sendReactionRolesEmbed();
    }
});

// ✅ Welcome message for new members
client.on("guildMemberAdd", async (member) => {
    if (recentJoins.has(member.id)) return;
    recentJoins.add(member.id);

    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return console.error("⚠️ Welcome channel not found!");

    const embed = new EmbedBuilder()
        .setTitle("Welcome to boards.lol!")
        .setDescription(
            `Welcome ${member}, to boards.lol! 🎉\n\nCheck out <#1340311371102814331>, or if you're here for support please go to our website, https://boards.lol.`
        )
        .setColor(0x0099ff)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 1024 }));

    await channel.send({ embeds: [embed] });

    setTimeout(() => recentJoins.delete(member.id), 60000);
});

// ✅ Song of the Day System (SOTD)
const songList = [
    { name: "Greedy", artist: "Tate McRae", link: "https://open.spotify.com/track/4ZPaBzMY32xb75srn21mrc" },
    { name: "Water", artist: "Tyla", link: "https://open.spotify.com/track/1DMEzmAoQIikcL52psptQL" },
    { name: "Paint The Town Red", artist: "Doja Cat", link: "https://open.spotify.com/track/6HxZ4nC7rGv1m5P4sdmgxB" },
    { name: "Slut!", artist: "Taylor Swift", link: "https://open.spotify.com/track/6ogwLJKtKKIUpAKnkk2whu" }
];

// ✅ Generate a pastel color
function getRandomPastelColor() {
    return `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, "0")}`;
}

async function sendSOTD() {
    const today = new Date().toISOString().split("T")[0];

    let lastSent = "";
    if (fs.existsSync(SOTD_FILE)) {
        const data = JSON.parse(fs.readFileSync(SOTD_FILE, "utf8"));
        lastSent = data.lastSent || "";
    }

    if (lastSent === today) {
        console.log("✅ SOTD already sent today, skipping...");
        return;
    }

    const song = songList[Math.floor(Math.random() * songList.length)];
    const channel = client.channels.cache.get(SOTD_CHANNEL_ID);
    if (!channel) return console.error("⚠️ SOTD channel not found!");

    const embed = new EmbedBuilder()
        .setTitle("🎶 Song of the Day")
        .setDescription(`**${song.name}** by **${song.artist}**\n[🎧 Listen on Spotify](${song.link})`)
        .setColor(getRandomPastelColor());

    const message = await channel.send({ content: `<@&${SOTD_PING_ROLE_ID}>`, embeds: [embed] });
    await message.react("<:bop:1341589766444945468>");
    await message.react("<:flop:1341589765157421126>");

    fs.writeFileSync(SOTD_FILE, JSON.stringify({ lastSent: today, messageId: message.id }, null, 2));
}

// ✅ Reaction Role System
const roles = {
    "🛠️": "1341592449889337424",
    "💬": "1341592376216391773",
    "😂": "1341592319169658880",
    "🎵": "1341592272629661828"
};

async function sendReactionRolesEmbed() {
    console.log("Checking if Reaction Roles embed should be sent...");

    if (fs.existsSync(REACTION_ROLES_FILE)) {
        console.log("❌ Reaction Roles embed already sent (file exists), skipping...");
        return;
    }

    const channel = client.channels.cache.get(REACTION_ROLES_CHANNEL_ID);
    if (!channel) {
        console.error("⚠️ Reaction Roles channel not found! Please check the channel ID.");
        return;
    }

    console.log(`✅ Found Reaction Roles channel: ${channel.name} (${REACTION_ROLES_CHANNEL_ID})`);

    try {
        const embed = new EmbedBuilder()
            .setTitle("📢 Reaction Roles")
            .setDescription(
                "React below to get notified about different events in the server! 🚀\n\n" +
                "🛠️ - Development Ping\n💬 - Dead Chat Ping\n😂 - Shitpost Ping\n🎵 - SOTD Ping\n\n" +
                "Click the reaction that corresponds to the role you want!"
            )
            .setColor("#7289DA");

        const message = await channel.send({ embeds: [embed] });
        for (const emoji of Object.keys(roles)) {
            await message.react(emoji);
        }

        fs.writeFileSync(REACTION_ROLES_FILE, JSON.stringify({ messageId: message.id }, null, 2));
        console.log("✅ Reaction Roles embed sent and file updated.");
    } catch (error) {
        console.error("⚠️ Error sending Reaction Roles embed:", error);
    }
}

// ✅ Reaction Handling for Adding Roles
client.on("messageReactionAdd", async (reaction, user) => {
    if (user.bot || !roles[reaction.emoji.name]) return;
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);

    await member.roles.add(roles[reaction.emoji.name]);

    const embed = new EmbedBuilder()
        .setTitle("✅ Role Assigned!")
        .setDescription(`You have been given the **${reaction.emoji.name}** role!`)
        .setColor("#00FF00");

    user.send({ embeds: [embed] }).catch(() => console.log("⚠️ Cannot DM user!"));
});

// ✅ Reaction Handling for Removing Roles
client.on("messageReactionRemove", async (reaction, user) => {
    if (user.bot || !roles[reaction.emoji.name]) return;
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);

    await member.roles.remove(roles[reaction.emoji.name]);

    const embed = new EmbedBuilder()
        .setTitle("❌ Role Removed!")
        .setDescription(`Your **${reaction.emoji.name}** role has been removed.`)
        .setColor("#FF0000");

    user.send({ embeds: [embed] }).catch(() => console.log("⚠️ Cannot DM user!"));
});

client.login(BOT_TOKEN);

