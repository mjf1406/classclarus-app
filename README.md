# ClassClarus

## To-do List

- UX: alert the user to instances of "...not progressing at the expected rate..." according to RAZ Plus. This means that if the student does not level up after 2 assessments, they get added to the RTI list.
- DB: added Teams
- Added Report Tab to the Scores Modal

- UI: Output Report Cards - when selecting a scale to apply to a subject, show the class grade distribution so the teacher can easily see if there are too many of the highest grade to maybe switch to a new scale that uses smaller range for the highest grade.

## Change Log

### 2025/07/11

- Feature: Graded Subjects - user can now CRUD interact with graded subjects
- Feature: Grade Scales - user can now CRUD interact with grade scales

### 2025/07/10

- UI: GradedAssigmentCard - added an indicator showing how many have been graded
- UI: GradedAssigmentCard - moved the edit, duplicate, and delete buttons into an action menu
- UX: GradedAssigmentCard - made the Sections section a collapsible
- UI: Scores Modal - excused students have their rows with 30% opacity and disabled inputs/buttons
- UX: Scores Modal - added Ctrl + Shift + Click as a x50 modifier
- UI: Scores Modal - tab list now stays at the top of the modal when switching

### 2025/07/09

- UX: number inputs are tab-navigable, skipping buttons in the Scores Modal
- UX: added 0.1 step to the number inputs in the Scores Modal
- UI: made a sexy number input with stepper buttons
- UI: added the scores modal so the user can input a total score or scores by section for the assignments.
- BE: scores save to DB and can be updated too
- BE: scores load correctly on reload and populate the modal

### 2025/07/08

- UX: Graded Assignment basic CRUD is now complete, can move onto adding scores to each assignment
- UX: added a button to duplicate an assignment which opens a creation dialog with everything filled out and name highlighted so the user can quickly change its name
- UX: updated_date is properly set on update now
- UX: deleting a graded assignment is now optimistic
- UX: creating a graded assignment is now optimistic
- UX: editing a graded assignment is now optimistic

### 2025/07/07

- UI: added a way to create a graded assignment
- UX: can keep the create graded assignment dialog open if you ctrl+enter or ctrl+click the submit button, otherwise will auto close on creation
- UI: added a list of graded assignments on the gradebook page
- UI: added delete and edit buttons that open the proper dialog, but currently do not function

### 2025/05/09

- BUG: fixed a bug when opening the delete class dialog makes all other elements on the page not clickable. Added `@apply pointer-events-auto;` to \* in @layer base -- **this is really stupid and should not be required**
- DB: fix delete class in class action menu: need to add missing tables to the schema
- UX: add a way to add a class with the Google Sheet template
- UX: add a way to archive and unarchive a class,
- UI: only unarchived classes show in the sidebar
- UI: added an archived classes section on the homepage
- UX: users can join classes as assistant teachers now

### 2025/05/03

- UX: added random assigner **this took a lot longer than I expected...**
- UX: added create assigner dialog

### 2025/05/02

- UX: new student dashboard with parallel routes is up!

### 2025/05/01

- Added a new tab under RAZ Plus that orders students by assessment need and gives a reason why they need to be assessed.

### 2025/04/26

- protected whole site and removed signin button

### 2025/04/16

- UI: added raz tab
- UX: on the raz tab, can create a test record

### 2025/04/13

- DB: added redemption_points and minus_points to student_classes table and calculated their values along with the points column. Will use to improve query times in the Points tab.
- UX: class action bar and all its functions work, except delete class
