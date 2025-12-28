# Testing Checklist

## Before First Use

### Installation Verification
- [ ] Extension loads without errors in `chrome://extensions/`
- [ ] Extension icon appears in Chrome toolbar
- [ ] No console errors when clicking extension icon
- [ ] Settings popup opens correctly

### Configuration Test
- [ ] Can select provider (Anthropic/OpenAI)
- [ ] Can enter API key (shows password dots)
- [ ] Can select model from dropdown
- [ ] Sliders move and update values
- [ ] Save button works (shows success message)
- [ ] Settings persist after closing popup

## Basic Functionality Tests

### Google Meet Integration
- [ ] Navigate to https://meet.google.com/
- [ ] Join a test meeting (can be alone)
- [ ] Floating panel appears automatically
- [ ] Panel is visible and positioned correctly
- [ ] Panel is draggable
- [ ] Minimize/expand button works

### Recording Test
- [ ] Click "Start" button
- [ ] Status changes to "Recording..."
- [ ] Screenshot counter increments
- [ ] Batch counter stays at 0 until first batch complete
- [ ] Stop button becomes enabled
- [ ] Start button becomes disabled

### Screenshot Capture
- [ ] Wait for first batch to complete (60 seconds with defaults)
- [ ] Check browser console for "📸 Screenshot captured" messages
- [ ] Verify no errors in console
- [ ] Confirm screenshots are being taken at correct interval

### AI Analysis
- [ ] After first batch (6 screenshots), analysis begins
- [ ] Status changes to "Analyzing..."
- [ ] Check console for "✅ Screenshots analyzed successfully"
- [ ] Transcript appears in output panel
- [ ] Batch counter increments to 1
- [ ] Screenshot counter resets to 0

### Transcript Display
- [ ] Transcript entry has timestamp
- [ ] Text is formatted correctly (bold, etc.)
- [ ] Panel auto-scrolls to bottom
- [ ] Multiple entries appear as batches complete
- [ ] Previous entries remain visible

### Controls Test
- [ ] Copy button copies transcript to clipboard
- [ ] Download button saves .txt file
- [ ] Clear button removes all transcript entries
- [ ] Stop button stops recording
- [ ] Can restart after stopping

## Edge Cases

### Error Handling
- [ ] Invalid API key shows error message
- [ ] Network failure handled gracefully
- [ ] API rate limit shows appropriate message
- [ ] Tab minimized - what happens?
- [ ] Meet page refreshed - panel disappears/reappears?

### Memory Management
- [ ] Record for 10+ minutes
- [ ] Check Chrome Task Manager (Shift+Esc)
- [ ] Memory usage stays reasonable
- [ ] No memory leaks visible
- [ ] Clear button actually frees memory

### Different Settings
- [ ] Test with interval = 5 seconds
- [ ] Test with interval = 30 seconds
- [ ] Test with batch size = 3
- [ ] Test with batch size = 12
- [ ] Test with quality = 25%
- [ ] Test with quality = 100%

## Provider-Specific Tests

### Anthropic Claude
- [ ] Works with Claude 3.5 Sonnet
- [ ] Works with Claude 3.5 Haiku
- [ ] Works with Claude 3 Opus
- [ ] Error messages are clear

### OpenAI GPT-4
- [ ] Works with GPT-4o
- [ ] Works with GPT-4o Mini
- [ ] Works with GPT-4 Turbo
- [ ] Error messages are clear

## Real-World Scenarios

### Solo Test
- [ ] Join Meet alone
- [ ] Enable captions
- [ ] Speak some test phrases
- [ ] Verify transcript captures captions

### Screen Share Test
- [ ] Share screen with text document
- [ ] Verify AI describes screen content
- [ ] Change screen content
- [ ] Verify updates in transcript

### Multi-Person Test
- [ ] Join Meet with another person
- [ ] Both enable captions
- [ ] Take turns speaking
- [ ] Verify both captured in transcript

### Long Meeting Test
- [ ] Record for 30+ minutes
- [ ] Verify consistent performance
- [ ] Check cost (API usage)
- [ ] Verify no degradation over time

## Performance Tests

### Latency
- [ ] Measure time from batch complete to transcript
- [ ] Should be 2-5 seconds typically
- [ ] Network speed affects this

### Resource Usage
- [ ] CPU: Should be minimal except during capture
- [ ] Memory: Should stay under 50 MB
- [ ] Network: ~200-300 KB per batch upload

### Cost Verification
- [ ] Check API provider dashboard
- [ ] Verify actual costs match estimates
- [ ] ~$0.09/hour for Anthropic
- [ ] ~$0.075/hour for OpenAI

## Compatibility Tests

### Browser Versions
- [ ] Latest Chrome (recommended)
- [ ] Chrome Beta
- [ ] Edge (Chromium-based)
- [ ] Brave browser

### Operating Systems
- [ ] macOS
- [ ] Windows
- [ ] Linux
- [ ] ChromeOS

### Meet Features
- [ ] Works with captions ON
- [ ] Works with captions OFF
- [ ] Works with screen share
- [ ] Works with background blur
- [ ] Works with virtual backgrounds

## Privacy Tests

### Data Handling
- [ ] Verify screenshots not in browser storage
- [ ] Check network tab - only HTTPS
- [ ] Confirm no unexpected API calls
- [ ] Verify transcript not auto-saved

### Cleanup
- [ ] Stop recording
- [ ] Check browser storage (chrome://local-storage)
- [ ] Only API key and settings should persist
- [ ] No screenshots or transcripts stored

## Documentation Tests

- [ ] README is clear and complete
- [ ] INSTALL instructions work
- [ ] QUICK_START is accurate
- [ ] Code comments are helpful
- [ ] No broken links in docs

## Pre-Production Checklist

Before sharing with others:

- [ ] All above tests pass
- [ ] No console errors in production use
- [ ] Privacy implications understood
- [ ] Cost implications verified
- [ ] Legal/compliance checked
- [ ] Meeting consent obtained
- [ ] Documentation complete

---

## Test Results Template

```
Date: _______________
Tester: _______________
Browser: _______________
OS: _______________
API Provider: _______________

Tests Passed: ___ / ___
Tests Failed: ___ / ___

Critical Issues:
-
-

Non-Critical Issues:
-
-

Notes:


```

## Known Issues

Document any known issues here:

1. Tab must remain visible for capture to work (Chrome limitation)
2. Best with Meet captions enabled (no actual audio capture yet)
3. [Add others as discovered]

---

**Last Updated**: December 28, 2025
**Version Tested**: 1.0.0

