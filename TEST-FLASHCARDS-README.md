# Flashcard Test Files

This folder contains test files to verify the flashcard import functionality in ThoughtsPlus.

## Test Files

### 1. `test-flashcards.txt` (Basic Knowledge)
- **Format**: Tab-separated text (Anki export format)
- **Content**: 20 general knowledge questions
- **Topics**: Geography, Math, History, Science, Programming
- **Use Case**: Test basic import functionality with simple Q&A pairs

### 2. `test-flashcards.csv` (Programming Basics)
- **Format**: CSV with headers (Front,Back)
- **Content**: 20 programming and web development questions
- **Topics**: React, TypeScript, Node.js, Git, APIs
- **Use Case**: Test CSV import with quoted fields

### 3. `test-flashcards-advanced.txt` (Technical Deep Dive)
- **Format**: Tab-separated text
- **Content**: 20 advanced JavaScript/React questions with detailed answers
- **Topics**: Closures, Promises, React Hooks, Event handling
- **Use Case**: Test import with longer, more complex text content

## How to Test

### Method 1: Drag and Drop
1. Open ThoughtsPlus
2. Navigate to Workspace → Click the Brain icon (Flashcards)
3. Drag any of the test files onto the flashcards page
4. Watch the automatic import process
5. Verify cards are imported correctly

### Method 2: Import Button
1. Open ThoughtsPlus Flashcards
2. Click "Import" button
3. Select one of the test files
4. Verify import completes successfully

### Method 3: Test with Real Anki Deck
1. Export a deck from Anki:
   - In Anki: File → Export
   - Choose "Notes in Plain Text (.txt)" OR "Anki Deck Package (.apkg)"
   - Save the file
2. Import into ThoughtsPlus using either method above

## Expected Results

### For .txt and .csv files:
- ✅ Import modal opens automatically (drag-and-drop)
- ✅ Loading animation shows progress (0% → 100%)
- ✅ New deck created with file name
- ✅ All cards imported with correct front/back content
- ✅ No HTML tags or special characters in card text

### For .apkg files:
- ✅ ZIP archive extracted successfully
- ✅ SQLite database parsed
- ✅ Deck name extracted from Anki metadata
- ✅ All cards imported with HTML entities decoded
- ✅ Empty cards filtered out
- ✅ Temporary files cleaned up

## Troubleshooting

### Import fails with .apkg file
- Ensure the file is a valid Anki package
- Check console for error messages
- Try exporting as .txt from Anki instead

### Cards show HTML tags
- This should be automatically cleaned
- If not, report as a bug with the specific file

### Import hangs or freezes
- Check file size (very large decks may take time)
- Look for console errors
- Try with a smaller test file first

## File Format Specifications

### Tab-Separated Text (.txt)
```
Front text[TAB]Back text
Question 1[TAB]Answer 1
Question 2[TAB]Answer 2
```

### CSV (.csv)
```
Front,Back
"Question 1","Answer 1"
"Question 2","Answer 2"
```

### Anki Package (.apkg)
- ZIP archive containing:
  - `collection.anki2` or `collection.anki21` (SQLite database)
  - Media files (optional)
- Fields separated by `\x1f` (ASCII Unit Separator)
- First two fields used as front/back

## Comparison Testing

To compare Anki import vs text import:

1. **Export from Anki as .txt**
   - Import into ThoughtsPlus
   - Note the deck name and card count

2. **Export same deck from Anki as .apkg**
   - Import into ThoughtsPlus
   - Compare:
     - Deck name (should match Anki deck name)
     - Card count (should be identical)
     - Card content (should be identical, with HTML cleaned)
     - Special characters (should be properly decoded)

3. **Verify Spaced Repetition**
   - Study a few cards
   - Check that ease factor, interval, and next review date are set
   - Verify SM-2 algorithm is working

## Performance Benchmarks

Expected import times (approximate):
- 20 cards: < 1 second
- 100 cards: 1-2 seconds
- 1000 cards: 5-10 seconds
- 5000+ cards: 20-30 seconds

If import takes significantly longer, check:
- File size
- Number of media files (for .apkg)
- System resources
- Console for errors

## Notes

- All test files use UTF-8 encoding
- Tab character is `\t` (ASCII 9)
- Line endings are `\n` (LF)
- CSV uses comma delimiter with optional quotes
- Special characters should be preserved during import
