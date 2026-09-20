# 💎 GRAM Farm AI - Cloud Mining & Investment Bot (Telegram Mini App)

Node.js, Express এবং Telegraf দিয়ে তৈরি একটি সম্পূর্ণ **GRAM Cloud Mining Bot ও Investment Mini App**। এতে রয়েছে **Tonkeeper ও TON Connect** ওয়ালেট ইন্টিগ্রেশন, রিয়েল-টাইম লাইভ মাইনিং টিক কাউন্টার, ইনভেস্টমেন্ট মাইনিং প্ল্যান, রেফারেল এবং রিওয়ার্ড সিস্টেম।

---

## 🌟 মূল ফিচারসমূহ (Key Features)

1. **টপ মাইনিং বক্স (Real-time Top Mining Box)**:
   - লাইভ রিয়েল-টাইম GRAM টোকেন মাইনিং জেনারেটর (মিলি-সেকেন্ড নির্ভুলতা)।
   - রিয়েল ৩ডি GRAM টোকেন লোগো ও কুলিং ফ্যান অ্যানিমেশন।
   - মাইনিং হ্যাশরেট (GH/s), ৩ ঘণ্টার স্টোরেজ ট্যাংক প্রগ্রেস বার এবং ইনস্ট্যান্ট **"Claim Mined GRAM"** বাটন।

2. **Tonkeeper & TON Connect ইন্টিগ্রেশন**:
   - উপরে ডিরেক্ট **"Connect Wallet"** বাটন।
   - ক্লিক করলেই পপ-আপ মডালে **Tonkeeper** (Recommended), Telegram @wallet, Tonhub এবং MyTonWallet এর লিস্ট আসবে।
   - Tonkeeper সিলেক্ট করে সরাসরি অন-চেইন ওয়ালেট কানেক্ট এবং ইনস্ট্যান্ট ২০০ GRAM রিওয়ার্ড।

3. **ইনভেস্টমেন্ট ও মাইনিং প্ল্যান (Investment Rigs Tiers)**:
   - **Tier 1: Starter GPU Rig** (15 GH/s, ফ্রি স্টার্টার)
   - **Tier 2: RTX 4090 Dual Farm** (85 GH/s, 6.5% Daily ROI)
   - **Tier 3: ASIC Gram Turbo X9** (350 GH/s, 11.0% Daily ROI)
   - **Tier 4: Quantum Cloud Supernode** (1500 GH/s, 18.5% Daily ROI)

4. **কালারফুল ও প্রিমিয়াম UI (No Eye-Straining Blur Glow)**:
   - আধুনিক ডিপ ডার্ক থিম, ক্রিস্প ১px বর্ডার, ভাইব্র্যান্ট গ্র্যাডিয়েন্ট এবং ঝকঝকে মোবাইল-ফার্স্ট রেসপন্সিভ ডিজাইন।

5. **রেফারেল ও ডেইলি টাস্ক (Quests & Affiliate)**:
   - ইউনিক রেফারেল লিংক জেনারেশন, ইনস্ট্যান্ট ১০০ GRAM বোনাস + ১০% লাইফটাইম মাইনিং কমিশন।
   - ডেইলি চেক-ইন স্ট্রিক ও টেলিগ্রাম কমিউনিটি বোনাস।

---

## 🚀 লোকাল রান করার নিয়ম (How to Run)

### ১. ডিপেন্ডেন্সি ইনস্টল করুন:
```bash
npm install
```

### ২. কনফিগারেশন সেট করুন (.env):
`.env` ফাইলে আপনার টেলিগ্রাম বটের টোকেন দিন (টোকেন ছাড়া ব্রাউজারেও টেস্ট করতে পারবেন):
```env
PORT=3000
BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN_HERE
APP_URL=http://localhost:3000
```

### ৩. সার্ভার স্টার্ট করুন:
```bash
npm start
```
ব্রাউজারে ভিজিট করুন: `http://localhost:3000`

---

## 🤖 টেলিগ্রাম বটের সাথে যুক্ত করার নিয়ম (Telegram Bot Setup)

1. টেলিগ্রামে **@BotFather** এ যান এবং `/newbot` লিখে নতুন বট তৈরি করুন।
2. প্রাপ্ত `HTTP API Token` টি কপি করে `.env` ফাইলের `BOT_TOKEN` এ বসিয়ে দিন।
3. BotFather-এ গিয়ে `/setmenubutton` অথবা `/newapp` দিয়ে আপনার লাইভ Web App URL সেট করুন।
4. বট চালু করার পর ইউজাররা `/start` লিখলেই **🚀 Launch Gram Farm App** বাটন পাবে এবং সরাসরি টেলিগ্রামের ভিতরে ফুলস্ক্রিন মিনি অ্যাপ ওপেন হবে।

---

## 📁 ফাইল স্ট্রাকচার (File Structure)

```
c:/Users/User/Downloads/Gram farm Ai/
├── package.json              # ডিপেন্ডেন্সি ও স্ক্রিপ্ট
├── .env                      # বট টোকেন ও পোর্ট কনফিগ
├── server/
│   ├── index.js              # Express সার্ভার
│   ├── bot.js                # Telegraf টেলিগ্রাম বট হ্যান্ডলার
│   ├── db.js                 # লোকাল ডাটাবেস ও লাইভ মাইনিং ইঞ্জিন
│   └── routes/
│       └── api.js            # মাইনিং, ওয়ালেট, প্ল্যান ও টাস্ক REST API
└── public/
    ├── index.html            # মূল মিনি অ্যাপ ইন্টারফেস
    ├── tonconnect-manifest.json # TonConnect অফিসিয়াল কনফিগ
    ├── css/
    │   ├── style.css         # আধুনিক কালারফুল ডিজাইন সিস্টেম
    │   └── animations.css    # স্মুথ মাইক্রো-অ্যানিমেশন
    ├── js/
    │   ├── app.js            # মাস্টার অ্যাপ কন্ট্রোলার
    │   ├── ton-connect.js    # Tonkeeper ওয়ালেট কানেকশন
    │   ├── mining.js         # টপ মাইনিং বক্স ও লাইভ কাউন্টার
    │   ├── plans.js          # ইনভেস্টমেন্ট প্ল্যান লজিক
    │   ├── tasks.js          # ডেইলি টাস্ক ও কোয়েস্ট
    │   └── wallet.js         # ওয়ালেট ডিপোজিট ও উইথড্র
    └── assets/
        ├── gram-logo.svg     # অফিসিয়াল ৩ডি GRAM কয়েন লোগো
        ├── tonkeeper-icon.svg# Tonkeeper অফিসিয়াল লোগো
        └── ton-logo.svg      # TON ক্রিপ্টো লোগো
```
