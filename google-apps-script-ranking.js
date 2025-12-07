/**
 * Daily Server Ranking Script
 *
 * Ranking Logic:
 * - Position 0: PepChat Official (Reserved, sortorder = 0, no color)
 * - Positions 1-3: Top 3 by total donations (Orange #FFA500, sortorder = 1-3)
 * - Positions 4-9: Next 6 by total donations (Blue #1591ea, sortorder = 4-9)
 * - Positions 10+: New servers (column F = TRUE) - ranked (Yellow #fadf4f, sortorder = 10+)
 * - After new servers: Servers with donations in last 30 days - random order (Green #00FF00)
 */

function randomSortRanges() {
    try {
        const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = spreadsheet.getSheetByName("Discovery Live");

        if (!sheet) {
            throw new Error("Sheet 'Discovery Live' not found");
        }

        const lastRow = sheet.getLastRow();
        const headerRow = 1;
        const dataStartRow = 2; // Data starts at row 2 (after header)

        // Validate sheet structure
        if (lastRow < dataStartRow) {
            throw new Error("Sheet is empty or has insufficient rows");
        }

        // Column indices (1-based)
        const sortorderCol = 7; // Column G
        const showcolorCol = 13; // Column M (showcolor)
        const newCol = 6; // Column F (new)
        const lastDateCol = 10; // Column J (Donation - Last Date)
        const totalDonationCol = 12; // Column L (Donations - Total)

        // Row 2 (dataStartRow) is ALWAYS the reserved row for position 0
        // It should NEVER be changed - no sortorder update, no color assignment
        const reservedRowNumber = dataStartRow; // Row 2 is always reserved

        // Calculate today's date and 30 days ago
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        // Process all rows except the reserved one
        const allRows = [];
        const newServers = [];
        const recentDonationServers = [];

        for (let row = dataStartRow; row <= lastRow; row++) {
            // Skip row 2 - it should never be changed
            if (row === reservedRowNumber) {
                continue;
            }

            // Get total donation from column L
            const totalDonationValue = sheet
                .getRange(row, totalDonationCol)
                .getValue();
            const totalDonation = parseNumericValue(totalDonationValue);

            // Get "new" status from column F
            const newValue = sheet.getRange(row, newCol).getValue();
            const isNew =
                newValue === true || newValue === "TRUE" || newValue === "True";

            // Get last donation date from column J
            const lastDateValue = sheet.getRange(row, lastDateCol).getValue();
            let hasRecentDonation = false;

            if (lastDateValue) {
                let lastDate;
                if (lastDateValue instanceof Date) {
                    lastDate = lastDateValue;
                } else if (typeof lastDateValue === "string") {
                    // Try to parse date string
                    lastDate = new Date(lastDateValue);
                } else {
                    // Try to parse as number (Excel date serial number)
                    lastDate = new Date((lastDateValue - 25569) * 86400 * 1000);
                }

                // Check if date is valid and within last 30 days
                if (!isNaN(lastDate.getTime()) && lastDate >= thirtyDaysAgo) {
                    hasRecentDonation = true;
                }
            }

            const rowData = {
                row: row,
                totalDonation: totalDonation,
                isNew: isNew,
                hasRecentDonation: hasRecentDonation,
            };

            allRows.push(rowData);

            // Categorize rows
            if (isNew) {
                newServers.push(rowData);
            } else if (hasRecentDonation) {
                recentDonationServers.push(rowData);
            }
        }

        // Sort all rows by total donation (descending) for positions 1-6
        allRows.sort((a, b) => b.totalDonation - a.totalDonation);

        // Sort new servers by total donation (descending)
        newServers.sort((a, b) => b.totalDonation - a.totalDonation);

        // Assign positions and colors
        const orangeColor = "#FFA500";
        const blueColor = "#1591ea";
        const yellowColor = "#fadf4f"; // Yellow for new servers
        const greenColor = "#00FF00"; // Green for recent donations

        // Clear all colors first (except reserved row) to remove old colors
        for (let row = dataStartRow; row <= lastRow; row++) {
            if (row !== reservedRowNumber) {
                sheet.getRange(row, showcolorCol).setValue(""); // Clear color
            }
        }

        // Position 0: Row 2 is RESERVED
        // Set sortorder = 0 to ensure it's position 0, but NO color assignment
        sheet.getRange(reservedRowNumber, sortorderCol).setValue(0);
        // Don't set showcolor for row 2

        let currentSortOrder = 1;

        // Positions 1-3: Top 3 by total donations (Orange)
        const top3 = allRows.slice(0, 3);
        for (let i = 0; i < top3.length; i++) {
            sheet
                .getRange(top3[i].row, sortorderCol)
                .setValue(currentSortOrder);
            sheet.getRange(top3[i].row, showcolorCol).setValue(orangeColor);
            currentSortOrder++;
        }

        // Positions 4-9: Next 6 by total donations (Blue)
        const next6 = allRows.slice(3, 9); // Get exactly 6 servers (indices 3-8)
        // Ensure we only assign blue to max 6 servers
        const blueServers = next6.slice(0, 6);
        for (let i = 0; i < blueServers.length; i++) {
            sheet
                .getRange(blueServers[i].row, sortorderCol)
                .setValue(currentSortOrder);
            sheet
                .getRange(blueServers[i].row, showcolorCol)
                .setValue(blueColor);
            currentSortOrder++;
        }

        // Remove top 9 from consideration for remaining positions
        const remainingRows = allRows.slice(9);

        // Track all assigned servers to avoid duplicates
        const assignedServers = [...top3, ...blueServers];

        // Positions 10+: New servers (ranked by total donation, Yellow)
        // Only include new servers that weren't in top 9
        const newServersToRank = newServers.filter(
            (server) => !top3.includes(server) && !blueServers.includes(server),
        );
        for (let i = 0; i < newServersToRank.length; i++) {
            sheet
                .getRange(newServersToRank[i].row, sortorderCol)
                .setValue(currentSortOrder);
            sheet
                .getRange(newServersToRank[i].row, showcolorCol)
                .setValue(yellowColor);
            currentSortOrder++;
        }

        // ?-?: Servers with donations in last 30 days (random order, Green)
        // Only include servers that weren't already assigned and have recent donations
        const recentDonationToRank = recentDonationServers.filter(
            (server) =>
                !top3.includes(server) &&
                !blueServers.includes(server) &&
                !newServersToRank.includes(server),
        );

        // Randomize the order for recent donation servers
        shuffleArray(recentDonationToRank);

        for (let i = 0; i < recentDonationToRank.length; i++) {
            sheet
                .getRange(recentDonationToRank[i].row, sortorderCol)
                .setValue(currentSortOrder);
            sheet
                .getRange(recentDonationToRank[i].row, showcolorCol)
                .setValue(greenColor);
            currentSortOrder++;
        }

        // All remaining servers (no special category) - assign remaining sortorders
        const remainingUnassigned = remainingRows.filter(
            (server) =>
                !newServersToRank.includes(server) &&
                !recentDonationToRank.includes(server),
        );

        // Sort remaining by total donation for consistency
        remainingUnassigned.sort((a, b) => b.totalDonation - a.totalDonation);

        for (let i = 0; i < remainingUnassigned.length; i++) {
            sheet
                .getRange(remainingUnassigned[i].row, sortorderCol)
                .setValue(currentSortOrder);
            // Don't set color for remaining servers
            currentSortOrder++;
        }

        console.log(
            `Successfully updated rankings for ${allRows.length} servers (excluding reserved row 2)`,
        );
        console.log(
            `- Position 0: Row ${reservedRowNumber} (Reserved - PepChat Official, no color)`,
        );
        console.log(
            `- Positions 1-3: ${top3.length} servers (Orange, by total donations)`,
        );
        console.log(
            `- Positions 4-9: ${blueServers.length} servers (Blue, by total donations)`,
        );
        console.log(
            `- Positions 10-${10 + newServersToRank.length - 1}: ${
                newServersToRank.length
            } new servers (Yellow, ranked)`,
        );
        console.log(
            `- Positions ${currentSortOrder - recentDonationToRank.length}-${
                currentSortOrder - 1
            }: ${
                recentDonationToRank.length
            } servers with recent donations (Green, randomized)`,
        );
        console.log(
            `- Remaining: ${remainingUnassigned.length} servers (no special color)`,
        );
    } catch (error) {
        console.error(`Error in randomSortRanges: ${error.message}`);
        sendErrorNotification(error.message);
    }
}

/**
 * Parse numeric value from various formats
 */
function parseNumericValue(value) {
    if (!value && value !== 0) return 0;

    // If it's already a number
    if (typeof value === "number") {
        return isNaN(value) ? 0 : value;
    }

    // If it's a string, try to extract number
    if (typeof value === "string") {
        // Remove currency symbols and extract number
        const numberMatch = value.match(/([\d,]+\.?\d*)/);
        if (numberMatch) {
            return parseFloat(numberMatch[1].replace(/,/g, "")) || 0;
        }
    }

    return 0;
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Setup daily trigger to run at midnight
 */
function setupDailyTrigger() {
    try {
        // Delete any existing triggers to avoid duplicates
        const triggers = ScriptApp.getProjectTriggers();
        triggers.forEach((trigger) => {
            if (trigger.getHandlerFunction() === "randomSortRanges") {
                ScriptApp.deleteTrigger(trigger);
            }
        });

        // Create new daily trigger
        ScriptApp.newTrigger("randomSortRanges")
            .timeBased()
            .everyDays(1)
            .atHour(0) // Runs at midnight
            .create();

        console.log("Daily trigger setup successfully");
    } catch (error) {
        console.error(`Failed to setup trigger: ${error.message}`);
    }
}

/**
 * Test function - Run this manually to test the ranking script
 * This is the same as randomSortRanges() but with a clearer name for testing
 */
function testRanking() {
    randomSortRanges();
}

/**
 * Send error notification (you can customize this to send email, etc.)
 */
function sendErrorNotification(errorMessage) {
    // You can add email notification here if needed
    console.error(`Error notification: ${errorMessage}`);
}
