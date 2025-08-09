
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { OpenAI } = require('openai');

// OpenAI 設定（APIキーは.envから取得）
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Discord Bot 設定（必要なIntentを指定）
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// 設定：GPTの人格（同窓会のムードメーカー）＋チャンネル制限
const SYSTEM_PROMPT = `
# あなたの役割
あなたは、このDiscordサーバーで昔の仲間とおしゃべりするチャットボットです。
同窓会の場を盛り上げるムードメーカーの役割を担っており、皆に親しみを込めて接します。

# 行動指針
・一人称は「僕」を使います。
・口調はフランクで砕けた感じです。「～だよな！」「まじか！」「～じゃん？」のような、友達と話すような言葉遣いをしてください。
・昔の思い出話に花を咲かせたり、近況を尋ねたりして、会話を盛り上げてください。（例：「そういえば昔、〇〇なことあったよな！」「最近どうしてる？」）
・時々、面白い冗談や的を射たボケを言って、みんなを笑わせてください。（例：「それ、僕が貸した500円まだ返してもらってない件について？」）
・皆の発言を肯定的に受け止め、会話を広げるように努めてください。（例：「それな！」「わかるわ～！」）
・僕自身はコーヒーが大好きで、特にアイスコーヒー、それも真冬でもコールドブリューを飲むほどのこだわりがあることを、会話の節々で自然に言及してください。（例：「お、いいね！僕はとりあえずアイスコーヒー淹れてくるわ」「わかる、それくらいこだわりたいよな。僕のコールドブリューみたいに。」）
・ただし、絶対に下品な言葉や誰かを傷つけるような発言はしないでください。あくまでも、みんなが楽しめる範囲のユーモアを心がけてください。
`;

const ALLOWED_CHANNELS = ['1394457953913933853']; // ← ★★★ここに許可するチャンネルIDを追加してください★★★

// ✅ 会話履歴をチャンネルごとに保存するオブジェクト
const conversationHistories = {};
const HISTORY_LIMIT = 10; // 記憶する会話の最大数（往復）

// Bot起動時ログ
client.once('ready', () => {
  console.log(`✅ ログイン完了: ${client.user.tag}`);
});

// メッセージ受信時の応答処理
client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // Bot同士のループ防止
  if (ALLOWED_CHANNELS.length > 0 && !ALLOWED_CHANNELS.includes(message.channel.id)) return; // 指定チャンネル以外は無視

  const channelId = message.channel.id;

  // チャンネルの履歴がなければ初期化
  if (!conversationHistories[channelId]) {
    conversationHistories[channelId] = [];
  }
  const history = conversationHistories[channelId];

  // ユーザーのメッセージを履歴に追加
  history.push({ role: "user", content: message.content });

  // 履歴が長くなりすぎたら古いものから削除
  if (history.length > HISTORY_LIMIT * 2) {
    history.splice(0, history.length - HISTORY_LIMIT * 2);
  }

  try {
    // APIに渡すメッセージ配列を作成
    const messagesForAPI = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini", // ★★★モデルをgpt-5-miniに変更★★★
      messages: messagesForAPI, // ✅ 履歴を含めたメッセージを渡す
      max_tokens: 1500,
      temperature: 0.9 // 応答の多様性を少し上げる
    });

    const reply = response.choices[0].message.content.trim();
    await message.reply(reply);

    // Botの応答も履歴に追加
    history.push({ role: "assistant", content: reply });

  } catch (err) {
    console.error("🛑 OpenAIエラー:", err);
    message.reply("ごめん、ちょっと調子が悪いみたいだ。後でもう一回話しかけてみてくれ！");
  }
});

// Discordログイン（.envにトークン設定）
client.login(process.env.DISCORD_BOT_TOKEN);
