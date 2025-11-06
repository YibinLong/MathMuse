**Description** 

A mobile-first (tablet with stylus preferred over a phone) app for handwriting math solution. This will essentially be a clone of Project Chiron. 

**Requirements** 

**Primary user flow (“Training mode”)** 

- Problem text shown at the top. 
- The child writes the solution **line by line** on a handwriting canvas. Visible guides are preferred to encourage a clear solution process. 
- Each line is automatically **split and recognized as a separate step**. 
- After each line, the app checks: 
  - **Correctness** – whether the math is valid. 
  - **Usefulness** – whether it moves the solution forward. 
- Correct & useful → accept and move to the next line. 
- Correct but not useful → accept with a mild nudge. 
- Incorrect → mark and provide a targeted hint. 

**Handwriting support** 

- Full handwriting input with multiple colors and erasing. 
- Undo in addition to erasing. 

**Guidance** 

- Show **tips** after inactivity or wrong input. 
- Hints escalate gradually — concept cue → directional hint → micro next step. 
- Never reveal the entire solution or full next step unless absolutely necessary. 
- Voice tutoring : short, useful verbal hints, not chatty.  

**Technology** 

- Build in **React Native** (tablet-focused). See comments. 
- Use an **external math solver** for checking (CameraMath preferred; Wolfram Alpha may be tried, Symbolab excluded). See comments. 

**Extras** 

1. **Cloud storage** of every attempt (problem, written lines, and outcomes). 
2. **Guide/Teacher app** with bidirectional contact — guide can see live progress and write directly into the student’s workspace. 
3. Tutorial mode with Direct Instruction-based tutorials (before giving students the problems from the same skill). 
4. Assessment mode - keep splitting the solution into lines, but check the entire thing only after clicking submit. 

**Comments** 

- React native is a weak requirement, but I think it's better to converge onto as an org (iPads are not guaranteed so no Swift, and Flutter seems like a semi-dead tech). We'll be able to use components if not the entire app. React-native-skia seems promising. 
- Choices of external math solver are described based on the actual experience. Wolfram has a weird API, and Symbolab is either a dead company or didn't even bother replying to me. CameraMath offers an initial free $10 of credits which will be completely sufficient. 
- **Practically, I'd be happier with a really nice and smooth tablet experience over implementation of extras so we can directly bring them into our (multiple) projects that need this** 

**Point of contact** 

- **Rafal Szulejko** rafal.szulejko@superbuilders.school (warning - UTC+1 timezone) - if urgent, msg on Gauntlet Slack 
- Might need to add someone Austin-based
