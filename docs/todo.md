# TODO #
A list of basic functionalities that will, should, or could be done.

### Active Issues ###
The following TODOs are under construction
- Make whiteboard into a stateful object.
	- accepts new send and receive connections
- Build basic whiteboard syncing

### To be done as part of the Minimum Viable Product (MVP)###
The following TODOs will need to be hit before publishing the MVP
- Allow arbitrarily named rooms
- build a room administrating interface
- generalize the rtc object so that
	- a new rtc connection gets made whenever a new peer joins, based on 
		the join signal
	- rtc objects get fully torn down when a peer hangs up
	- together these should prevent rooms from getting used up as they
		currently do

### To be done post MVP ###
These TODOs are judged to be necessary for the application, but will come
after the MVP stage.
- Move functions that are not really application specific to a common lib
	(e.g.: some using `result2json` in php/signal.php

### Wishlist ###
The following TODOs dont want to be forgotten, but they arent being actively
pursued at the moment.  In truth, some will never be done.

