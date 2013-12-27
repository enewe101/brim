OVERVIEW 
~~~~~~~~
This software cand be installed into a public directory that gets served by an
ordinary webserver e.g. apache, and it will provide a webpage that allows users
to do video chat and (soon) collaborate via a whiteboard.

The application uses `rooms'.  When a client requests the index.php page from
the webserver, e.g. <example.com/index.php>, they'll be put into a random 
room with a six digit hex name, e.g. '123abc'.  Their friend can join them
by navigating to <example.com/index.php?room_id=123abc>.

The `room' is just a way for the server to providing a signalling mechanism 
between the two clients.  When the second client joins, signalling takes place
to negotiate video/audio encoding and let the clients know eachother's public
IP addresses.  All the heavy lifting is taken care of by webRTC.  After 
signalling all the communication between friends is direct from browser to 
browser, so the server never handles any heavy audio/video, only a bit of 
text signalling.

If you don't know what webRTC is, definitely look it up.  It makes setting up
audio and video chat on a webpage much easier than it would otherwise be.


SOME NOTES ABOUT DEPENDENCY AND CREDIT
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
* Non-shipped dependencies *

	this also requires an installed php server and mysql server.

* Shipped dependencies * 

	- prototype  -- (I intend to switch to jquery)
	- adaptor.js -- a script that handles browser differences in implementing
					webRTC
	- paper.js   -- a library for drawing vectors on canvas

* Credit goes to * 

	In order to understand the webRTC framework, I worked from the example app
	at <http://apprtc.appspot.com/>. I copied a lot of their code used to 
	handle signalling between browsers.


HOW THE SOFTWARE WORKS
~~~~~~~~~~~~~~~~~~~~~~
* Signalling Channel * 

	In general, two browsers cannot talk directly to eachother.  There are
	two reasons for this.  

	First, browser software isn't (normally) set up to listen for signals other
	than replies to it's http requests (but webRTC in chrome and firefox do 
	enable this).

	Second, the browsers don't normally know one another's public IP address.
	
	For webRTC to set up a direct two-way connection between browsers, we need
	a server to act as a meeting point, and mediate an exchange of messages
	allowing the browsers to find eachother, as well as negotiate things like
	codecs for the transmission of audio/video.

	In this implementation, I'm using a rather crude, but easy to understand
	method for signalling via a database.  Messages sent by clients are
	logged in the database by the server.  At a regular frequency, the
	clients poll the server for any messages that are addressed to them, that
	have arrived since their last poll.

	Obviously this means that the clients repetitively poll the server, causing
	unnecessary traffic, so using websockets (e.g. the node.js package 
	socket.io), should be pursued

* webRTC *
	
	This deserves its own explanation, since it can be quite confusing at first
	if you, like me, are only a user of the small set of web protocols involved
	in serving webpages, and don't have a good handle on their implementation
	nor on the general problem of implementing communication protocols.

	But I intend to put up a tutorial on using webRTC, and it would be more 
	efficient to use that content to write this, rather than vice versa, so
	I postpone authoring this section until later.


