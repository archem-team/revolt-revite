# Google Apps Script - Manual Testing Guide

## How to Run the Script Manually

### Step 1: Open Google Apps Script Editor
1. Open your Google Sheet
2. Go to **Extensions** → **Apps Script**
3. The Apps Script editor will open in a new tab

### Step 2: Copy the Script
1. Copy the entire contents of `google-apps-script-ranking.js`
2. Paste it into the Apps Script editor (replace any existing code)

### Step 3: Save the Script
1. Click **File** → **Save** (or press `Cmd+S` / `Ctrl+S`)
2. Give your project a name (e.g., "Server Ranking Script")

### Step 4: Run the Script Manually

You have **two options** to run the script:

#### Option A: Run `testRanking()` function (Recommended for testing)
1. In the function dropdown at the top, select **`testRanking`**
2. Click the **Run** button (▶️) next to the dropdown
3. The script will execute and update your sheet

#### Option B: Run `randomSortRanges()` function directly
1. In the function dropdown at the top, select **`randomSortRanges`**
2. Click the **Run** button (▶️) next to the dropdown
3. The script will execute and update your sheet

### Step 5: Authorize the Script (First Time Only)
1. When you run the script for the first time, Google will ask for authorization
2. Click **Review Permissions**
3. Select your Google account
4. Click **Advanced** → **Go to [Your Project Name] (unsafe)**
5. Click **Allow** to grant permissions

### Step 6: View Results
1. Go back to your Google Sheet
2. Check the `sortorder` column (Column G) and `showcolor` column (Column N)
3. The rankings should be updated according to the logic:
   - Position 1: Reserved (unchanged)
   - Position 2: Orange (#FFA500)
   - Positions 3-12: Green (#00FF00) - randomized
   - Positions 13-22: Blue (#1591ea) - randomized
   - Positions 23+: Randomized (no color change)

### Step 7: View Execution Logs
1. In the Apps Script editor, click **View** → **Logs** (or press `Cmd+Enter` / `Ctrl+Enter`)
2. You'll see console output showing:
   - How many servers were processed
   - How many servers in each group
   - Any errors (if they occur)

## Setting Up Daily Automatic Execution

To set up the script to run automatically every day at midnight:

1. In the Apps Script editor, select **`setupDailyTrigger`** from the function dropdown
2. Click **Run** (▶️)
3. The script will create a daily trigger
4. You'll see a confirmation message in the logs

## Troubleshooting

### Script doesn't run
- Make sure you've authorized the script (Step 5)
- Check that the sheet name is exactly "Discovery Live"
- Verify that donation columns exist in the header row

### Wrong results
- Check the execution logs for error messages
- Verify that donation columns are properly formatted
- Make sure the `sortorder` column (G) and `showcolor` column (N) exist

### Permission errors
- Go to **View** → **Executions** to see detailed error messages
- Re-authorize the script if needed

## Quick Test Checklist

- [ ] Script copied to Apps Script editor
- [ ] Script saved
- [ ] `testRanking()` function selected
- [ ] Script executed successfully
- [ ] Permissions granted (first time)
- [ ] Results visible in Google Sheet
- [ ] Logs checked for confirmation





