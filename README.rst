This is the official repository for the Google Chrome Extension called `Tab Organizer <https://chrome.google.com/webstore/detail/tab-organizer/gbaokejhnafeofbniplkljehipcekkbh>`_.

It uses the `Google Closure Compiler <https://developers.google.com/closure/compiler/>`_.

How to install
==============

If you're a normal user, you shouldn't be using this repository. Instead, install the version in the `Chrome Web Store <https://chrome.google.com/webstore/detail/tab-organizer/gbaokejhnafeofbniplkljehipcekkbh>`_ which is automatically updated.

But if you're a developer, or want to try the absolute latest version before release, you can follow these steps:

* Make sure you have git, `Node.js <http://nodejs.org/>`_, and Java.
* ``git clone --recursive https://github.com/Pauan/tab-organizer.git``
* ``cd tab-organizer``
* ``mkdir closure-compiler``
* Download the `Closure Compiler <http://dl.google.com/closure-compiler/compiler-latest.zip>`_ and unzip it into the ``closure-compiler`` folder.
* ``./build.js``
* Now, in Google Chrome, go to the URL ``chrome://extensions/``
* Make sure ``Developer mode`` (in the upper-right) is checked.
* Click the ``Load unpacked extension...`` button.
* Navigate to the ``tab-organizer/build`` folder, then click ``Open`` or ``OK``.

How to update
=============

* ``cd tab-organizer``
* ``git pull``
* ``./build.js``
* Now, in Google Chrome, go to the URL ``chrome://extensions/``
* Find the Tab Organizer extension in the list then click the ``Reload (Ctrl+R)`` link.
