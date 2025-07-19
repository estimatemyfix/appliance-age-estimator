# 📤 MANUAL GIT UPLOAD GUIDE

## 🚫 Git Not Available in PowerShell
Your system doesn't have git available in PowerShell, so here are manual options:

---

## 🔄 Option 1: GitHub Desktop (Easiest)

### Step 1: Download GitHub Desktop
1. **Go to [desktop.github.com](https://desktop.github.com)**
2. **Download and install GitHub Desktop**
3. **Sign in with your GitHub account**

### Step 2: Open Your Repository
1. **File → Clone Repository**
2. **Select your `appliance-age-estimator` repository**
3. **Choose local path: `C:\Users\baahb\OneDrive\Desktop\APplinace411`**

### Step 3: Commit and Push
1. **GitHub Desktop will show all your changes**
2. **Add commit message:** "NUCLEAR OPTION: Add explicit examples for parts, costs, and YouTube videos"
3. **Click "Commit to master"**
4. **Click "Push origin"**
5. **Netlify will auto-deploy in ~2 minutes**

---

## 🌐 Option 2: GitHub Website Upload

### Step 1: Go to GitHub
1. **Visit [github.com/estimatemyfix/appliance-age-estimator](https://github.com/estimatemyfix/appliance-age-estimator)**
2. **Sign in to your account**

### Step 2: Upload Files
1. **Click "Upload files" button**
2. **Drag these modified files:**
   - `netlify/functions/analyze-appliance.js`
   - `server.js`
   - `DEPLOY.md`

### Step 3: Commit
1. **Add commit message:** "NUCLEAR OPTION: Add explicit examples for parts and YouTube videos"
2. **Click "Commit changes"**
3. **Netlify will auto-deploy**

---

## 🎯 Files That Changed (Nuclear Option Updates):

✅ **`netlify/functions/analyze-appliance.js`** - Added explicit examples:
- Real part numbers: WE11X10018, WH13X10037, WH08X10036
- Specific costs: $150-$245, $125-$215, $195-$335
- Amazon/eBay links: "WE11X10018 dryer heating element"
- YouTube videos: "How to Replace Dryer Heating Element"

✅ **`server.js`** - Same nuclear option updates for local testing

✅ **`DEPLOY.md`** - Deployment guide

---

## 🚀 After Upload:
1. **Netlify will auto-deploy** (check your Netlify dashboard)
2. **Test your site** with an appliance photo
3. **Look for the new sections** with real part numbers and YouTube links

**Choose Option 1 (GitHub Desktop) if you want the easiest long-term solution!** 💪 