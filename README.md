# ClassClarus

## To-do List

- UX: alert the user to instances of "...not progressing at the expected rate..." according to RAZ Plus. This means that if the student does not level up after 2 assessments, they get added to the RTI list.
- DB: add Teams

## Change Log

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
