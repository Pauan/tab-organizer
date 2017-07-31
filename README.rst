This is the official repository for the Google Chrome Extension called `Tab Organizer <https://chrome.google.com/webstore/detail/tab-organizer/gbaokejhnafeofbniplkljehipcekkbh>`_.

How to install
==============

If you're a normal user, you should *NOT* be using this repository. Instead, install the version in the `Chrome Web Store <https://chrome.google.com/webstore/detail/tab-organizer/gbaokejhnafeofbniplkljehipcekkbh>`_ which is automatically updated.

But if you're a developer, or you want to try the absolute latest version before release, you can follow these steps:

1. Make sure you have ``git`` and `Nix <https://nixos.org/nix/>`_ installed.
2. ``git clone --branch haxe https://github.com/Pauan/tab-organizer.git``
3. ``cd tab-organizer``
4. ``nix-build`` (this might take a long time)
5. In Google Chrome, go to the URL ``chrome://extensions/``
6. Make sure ``Developer mode`` (in the upper-right) is checked.
7. Click the ``Load unpacked extension...`` button.
8. Navigate to the ``tab-organizer/result`` folder, then click ``Open`` or ``OK``.

How to update
=============

1. ``cd tab-organizer``
2. ``git pull``
3. ``nix-build``
4. In Google Chrome, go to the URL ``chrome://extensions/``
5. Find the Tab Organizer extension in the list, then click the ``Reload (Ctrl+R)`` link.

How to develop
==============

1. Make your changes to the code.
2. ``nix-build --arg production false``
3. In Google Chrome, go to the URL ``chrome://extensions/``
4. Find the Tab Organizer extension in the list, then click the ``Reload (Ctrl+R)`` link.

How to run tests
================

1. ``nix-build --arg production false --arg test true``
2. In Google Chrome, go to the URL ``chrome://extensions/``
3. Find the Tab Organizer extension in the list, then click the ``Reload (Ctrl+R)`` link.
4. After it finishes loading, click on the ``server.html`` link.
5. Check the console for any errors.
