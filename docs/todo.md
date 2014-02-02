# TODO #
A list of basic functionalities that will, should, or could be done.


### Active Issues ###
The following TODOs are under construction


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

- Allow the whiteboard to dynamically accept more than one peer

- resolve the addressing of paths among peers
	- keeping separate dictionaries for each peer allows protections 
		to be built in

- Clear button

- Resolve the performance issue when there are a lot of vectors
	- For pen, brush, erase, and other pixel-based tools, we probably dont 
		need to keep the vector representations.  Either:
		- continue to use the paper.js api as a convenient standard to issue
			directives to the canvas (and parse peer directives), while 
			finding a way to drop the vectors for pixel pased marks from 
			paper.js after their effects to the canvas have been rendered
			
								- or -

		- Implement pixel based tools directly on the canvas api
		

### To be done post MVP ###
These TODOs are judged to be necessary for the application, but will come
after the MVP stage.
- Move functions that are not really application specific to a common lib
	(e.g.: some using `result2json` in php/signal.php
- Allow tabbed layers
- Allow adjustable panes


### Wishlist ###
The following TODOs dont want to be forgotten, but they arent being actively
pursued at the moment.  In truth, some will never be done.

