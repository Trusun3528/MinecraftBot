const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const axios = require('axios'); // Make sure to install axios
const { mineflayer: mineflayerViewer } = require('prismarine-viewer');

// Create the bot
const bot = mineflayer.createBot({
  host: 'localhost',
  username: 'Jeff',
  auth: 'offline',
});

bot.loadPlugin(pathfinder);

let conversationHistory = [];
let followPlayer = null; // Variable to keep track of the player being followed

// Chat event listener
bot.on('chat', async (username, message) => {
  if (username === bot.username) return; // Ignore messages from the bot itself

  const botName = 'Jeff'; // Replace with your bot's username
  const botNamePattern = new RegExp(`\\b${botName}\\b`, 'i'); // Create a case-insensitive regex pattern for the bot's name

  console.log(`Received message from ${username}: ${message}`);

  if (botNamePattern.test(message)) {
    console.log(`Message includes bot's name: ${botName}`);

    if (message.toLowerCase().includes("follow me")) {
      followPlayer = username;
      bot.chat(`Okay ${username}, I will follow you.`);
      startFollowingPlayer(username);
    } else if (message.toLowerCase().includes("stop following me")) {
      if (followPlayer === username) {
        followPlayer = null;
        bot.chat(`Okay ${username}, I will stop following you.`);
        stopFollowingPlayer();
      }
    } else if (message.toLowerCase().includes("go mine")) {
      bot.chat(`Alright ${username}, I'll start mining for lapis, gold, iron, redstone, diamonds, and emeralds.`);
      startMining();
    } else {
      // Add user message to conversation history
      conversationHistory.push({ role: 'user', content: message });

      // Send the user's message to the Ollama API for a response
      try {
        const response = await getOllamaResponse(message);
        bot.chat(response);
        // Add AI response to conversation history
        conversationHistory.push({ role: 'assistant', content: response });
      } catch (error) {
        console.error('Error communicating with Ollama:', error);
        bot.chat('Sorry, I encountered an error while processing your request.');
      }
    }
  } else {
    console.log(`Message does not include bot's name: ${botName}`);
  }
});

// Function to get response from Ollama
async function getOllamaResponse(input) {
  const url = 'http://127.0.0.1:11434/api/generate'; // Replace with your Ollama API endpoint
  const model = 'gemma2:9b'; // Replace with the name of the model you want to use
  
  console.log(`Sending request to Ollama with prompt: ${input}`);
  
  try {
    const response = await axios.post(url, {
      model: model, // Specify the model here
      prompt: conversationHistory.map(entry => `${entry.role}: ${entry.content}`).join('\n') + `\nuser: ${input}`
    });

    console.log(`Received response from Ollama: ${response.data}`);
    
    let completeResponse = '';
    const responseChunks = response.data.split('\n');

    responseChunks.forEach(chunk => {
      if (chunk) {
        const chunkData = JSON.parse(chunk);
        if (chunkData.response) {
          completeResponse += chunkData.response;
        }
      }
    });

    console.log(`Complete response: ${completeResponse}`);
    return completeResponse;
  } catch (error) {
    console.error('Error communicating with Ollama:', error);
    return 'Sorry, I encountered an error while processing your request.';
  }
}

// Function to follow the player
function startFollowingPlayer(playerName) {
  const player = bot.players[playerName];
  if (player && player.entity) {
    const target = player.entity.position;
    bot.pathfinder.setMovements(new Movements(bot, bot.mcData));
    bot.pathfinder.setGoal(new goals.GoalFollow(player.entity, 1), true);
  }
}

function stopFollowingPlayer() {
  bot.pathfinder.stop();
}

// Function to start mining
function startMining() {
  const oreTypes = ['lapis_lazuli_ore', 'gold_ore', 'iron_ore', 'redstone_ore', 'diamond_ore', 'emerald_ore'];

  bot.on('blockUpdate', async (oldBlock, newBlock) => {
    if (oreTypes.includes(newBlock.name)) {
      const goal = new goals.GoalBlock(newBlock.position.x, newBlock.position.y, newBlock.position.z);
      bot.pathfinder.setGoal(goal);
      await bot.dig(newBlock);
      bot.chat(`Mined ${newBlock.name} at ${newBlock.position}`);
    }
  });
}

// Viewer setup
bot.once('spawn', () => {
  mineflayerViewer(bot, { port: 3007, firstPerson: false });
});

// Log errors and kick reasons
bot.on('kicked', console.log);
bot.on('error', console.log);
