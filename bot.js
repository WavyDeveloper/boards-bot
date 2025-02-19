const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

const DATA_FOLDER = './data/guilds/';
if (!fs.existsSync(DATA_FOLDER)) {
    fs.mkdirSync(DATA_FOLDER, { recursive: true });
}

function loadGuildConfig(guildId) {
    const filePath = `${DATA_FOLDER}${guildId}.json`;
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({ guildId, staffRole: null, managerRole: null, logChannel: null, shiftLogChannel: null, loaRole: null, warnings: {}, shifts: [] }, null, 2));
    }
    return JSON.parse(fs.readFileSync(filePath));
}

function saveGuildConfig(guildId, config) {
    fs.writeFileSync(`${DATA_FOLDER}${guildId}.json`, JSON.stringify(config, null, 2));
}

const commands = [
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup staff role, manager role, logging channel, shift log channel, and LOA role')
        .addRoleOption(option => option.setName('staffrole').setDescription('Staff role').setRequired(true))
        .addRoleOption(option => option.setName('managerrole').setDescription('Manager role').setRequired(true))
        .addChannelOption(option => option.setName('logchannel').setDescription('Logging channel').setRequired(true))
        .addChannelOption(option => option.setName('shiftlogchannel').setDescription('Shift log channel').setRequired(true))
        .addRoleOption(option => option.setName('loarole').setDescription('Role given to user during LOA').setRequired(true)),

    new SlashCommandBuilder()
        .setName('loarequest')
        .setDescription('Submit a leave of absence request')
        .addStringOption(option => option.setName('duration').setDescription('Duration of leave').setRequired(true))
        .addStringOption(option => option.setName('startdate').setDescription('Start date of leave').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for leave').setRequired(true)),

    new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user and send them a DM about the warning')
        .addUserOption(option => option.setName('user').setDescription('User to warn').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for the warning').setRequired(true)),

    new SlashCommandBuilder()
        .setName('showwarnings')
        .setDescription('Show all warnings for a specific user')
        .addUserOption(option => option.setName('user').setDescription('User to show warnings for').setRequired(true)),

    new SlashCommandBuilder()
        .setName('stafflist')
        .setDescription('Show all members with the staff role'),

    new SlashCommandBuilder()
        .setName('startshift')
        .setDescription('Start a shift event and log it in the shift logging channel')
        .addStringOption(option => option.setName('description').setDescription('Description of the shift').setRequired(true)),
];

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands.map(cmd => cmd.toJSON()) });
        console.log('✅ Slash commands registered!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const guildId = interaction.guild.id;
    const config = loadGuildConfig(guildId);

    if (interaction.commandName === 'setup') {
        if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: '❌ You need Administrator permission!', flags: 64 });

        const staffRole = interaction.options.getRole('staffrole');
        const managerRole = interaction.options.getRole('managerrole');
        const logChannel = interaction.options.getChannel('logchannel');
        const shiftLogChannel = interaction.options.getChannel('shiftlogchannel');
        const loaRole = interaction.options.getRole('loarole');

        config.staffRole = staffRole.id;
        config.managerRole = managerRole.id;
        config.logChannel = logChannel.id;
        config.shiftLogChannel = shiftLogChannel.id;
        config.loaRole = loaRole.id;
        saveGuildConfig(guildId, config);

        return interaction.reply({
            content: `✅ Setup complete! Staff Role: <@&${config.staffRole}>, Manager Role: <@&${config.managerRole}>, LOA Role: <@&${config.loaRole}>, Log Channel: <#${config.logChannel}>, Shift Log Channel: <#${config.shiftLogChannel}>`,
            flags: 64
        });
    }

    if (interaction.commandName === 'loarequest') {
        const duration = interaction.options.getString('duration');
        const startDate = interaction.options.getString('startdate');
        const reason = interaction.options.getString('reason');
        const logChannel = interaction.guild.channels.cache.get(config.logChannel);

        if (!logChannel) return interaction.reply({ content: '❌ Log channel not set!', flags: 64 });

        const loaEmbed = {
            color: 0x0099ff,
            title: 'Leave of Absence Request',
            fields: [
                { name: 'Duration', value: duration },
                { name: 'Start Date', value: startDate },
                { name: 'Reason', value: reason },
                { name: 'Requested by', value: interaction.user.tag }
            ]
        };

        const acceptButton = new ButtonBuilder()
            .setCustomId('accept_loa')
            .setLabel('Accept')
            .setStyle(ButtonStyle.Success);

        const declineButton = new ButtonBuilder()
            .setCustomId('decline_loa')
            .setLabel('Decline')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);

        await logChannel.send({ embeds: [loaEmbed], components: [row] });

        return interaction.reply({ content: '✅ LOA Request submitted for review!', flags: 64 });
    }

    if (interaction.commandName === 'warn') {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const warnings = config.warnings[user.id] || [];

        warnings.push(reason);
        config.warnings[user.id] = warnings;
        saveGuildConfig(guildId, config);

        // Send DM to the user about the warning
        try {
            await user.send({
                content: `You have received a warning in ${interaction.guild.name} for the following reason: ${reason}`,
            });
        } catch (error) {
            console.error(`Failed to DM ${user.tag}:`, error);
        }

        return interaction.reply({
            content: `✅ ${user.tag} has been warned for: "${reason}".`,
            flags: 64
        });
    }

    if (interaction.commandName === 'showwarnings') {
        const user = interaction.options.getUser('user');
        const warnings = config.warnings[user.id];

        if (!warnings || warnings.length === 0) return interaction.reply({ content: `❌ No warnings found for ${user.tag}.`, flags: 64 });

        const warningsEmbed = {
            color: 0xff0000,
            title: `Warnings for ${user.tag}`,
            description: warnings.map((warning, index) => `**ID**: ${index + 1} - ${warning}`).join('\n') || 'No warnings available.'
        };

        return interaction.reply({ embeds: [warningsEmbed], flags: 64 });
    }

    if (interaction.commandName === 'stafflist') {
        const staffMembers = interaction.guild.members.cache.filter(member => member.roles.cache.has(config.staffRole));
        if (!staffMembers.size) return interaction.reply('❌ No staff members found!');

        const staffListEmbed = {
            color: 0x00ff00,
            title: 'Staff Members',
            description: staffMembers.map(member => `<@${member.id}>`).join('\n')
        };

        return interaction.reply({ embeds: [staffListEmbed], flags: 64 });
    }

    if (interaction.commandName === 'startshift') {
        const description = interaction.options.getString('description');
        const shiftLogChannel = interaction.guild.channels.cache.get(config.shiftLogChannel);

        if (!shiftLogChannel) return interaction.reply({ content: '❌ Shift log channel not set!', flags: 64 });

        const shiftEmbed = {
            color: 0x0099ff,
            title: 'Shift Started',
            fields: [
                { name: 'Description', value: description },
                { name: 'Started by', value: interaction.user.tag }
            ]
        };

        config.shifts.push({ description, startedBy: interaction.user.tag });
        saveGuildConfig(guildId, config);

        await shiftLogChannel.send({ embeds: [shiftEmbed] });

        return interaction.reply({ content: `✅ Shift started!`, flags: 64 });
    }
    
    // Handle button interactions
    if (interaction.isButton()) {
        if (!interaction.guild) return;

        const config = loadGuildConfig(interaction.guild.id);
        const managerRole = interaction.guild.roles.cache.get(config.managerRole);

        if (!interaction.member.roles.cache.has(managerRole.id)) {
            return interaction.reply({ content: '❌ You need the manager role to approve or decline this request.', ephemeral: true });
        }

        // Extract the user ID from the embed (it should be a snowflake)
        const userId = interaction.message.embeds[0].fields.find(field => field.name === 'Requested by').value.replace(/[^\d]/g, '');
        
        // Ensure userId is a valid snowflake
        if (!userId || isNaN(userId)) {
            return interaction.reply({ content: '❌ Invalid user ID in the embed.', ephemeral: true });
        }

        const user = await interaction.guild.members.fetch(userId);

        if (interaction.customId === 'accept_loa') {
            const loaRole = interaction.guild.roles.cache.get(config.loaRole);
            await user.roles.add(loaRole);
            await user.send(`Your Leave of Absence request has been approved. You are now marked as on LOA.`);

            return interaction.reply({ content: `✅ ${user.user.tag}'s LOA request has been approved.`, ephemeral: true });
        } else if (interaction.customId === 'decline_loa') {
            await user.send(`Your Leave of Absence request has been declined.`);

            return interaction.reply({ content: `❌ ${user.user.tag}'s LOA request has been declined.`, ephemeral: true });
        }
    }
});

client.login(process.env.BOT_TOKEN);
