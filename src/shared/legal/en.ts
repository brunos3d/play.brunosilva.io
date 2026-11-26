import type { LegalContent } from "./content";

export const en: LegalContent = {
  privacy: {
    short: "Privacy",
    title: "Privacy policy",
    intro: [
      "Minigames (play.brunosilva.io) is a free site of daily puzzles, made and run by Bruno Silva as a personal project. This page says what the site stores, where it stores it and why.",
      "Nothing here is sold or shared for advertising. The site has no ads, no analytics and no trackers.",
    ],
    sections: [
      {
        heading: "The short version",
        blocks: [
          {
            list: [
              "You can play every game without an account and without giving any personal data.",
              "Your progress, your settings and your results stay in your browser.",
              "The server stores something about you only when you solve a daily puzzle (for the ranking), join a challenge room, edit your profile, turn on reminders or create an account: a display name, a nickname, an avatar, your daily results and, with reminders on, where to send them.",
              "The site never asks for an email address, a password, a phone number or your real name.",
              "You can delete your player and everything stored about it at any time, on the Profile page.",
            ],
          },
        ],
      },
      {
        heading: "What stays on your device",
        blocks: [
          "This is kept by your browser. It is not sent to the server, except for what the section about the server lists.",
          {
            list: [
              "Settings (local storage): sound, vibration, theme, the language of the games, which tutorials you have seen, the fact that you accepted the cookie notice, and when you said \"not now\" to installing the app or to reminders.",
              "Progress (IndexedDB): the boards you are playing, the result of each daily puzzle, your streaks and your best times.",
              "A short list of practice puzzles you started over (local storage), so a second try does not set a best time.",
              "An offline copy of the site (cache storage): the pages, scripts and word lists it needs to open without a connection.",
            ],
          },
          "Clearing your browser's data for this site removes all of it. A board you are still playing is not copied between devices. The dailies you have closed are, once the server has a player for you: see the next sections.",
        ],
      },
      {
        heading: "Cookies",
        blocks: [
          "The site sets only the cookies it needs to work. None of them follows you to other sites, and none is used for advertising or statistics.",
          {
            list: [
              "NEXT_LOCALE: the language you chose for the interface. Kept for 1 year.",
              "play_player: the player of this device, as an id and a random secret. Set the first time you solve a daily puzzle, join a room, save your profile or turn on reminders. Kept for 2 years. Scripts on the page cannot read it.",
              "play_session: says this device is signed in to an account. Set when you create a passkey or sign in with one. Kept for 2 years, or until you sign out. It stops working after 180 days without use.",
              "play_challenge: a one-time value used while a passkey is being created or checked. Kept for 5 minutes.",
            ],
          },
          "Because these cookies are required for the features you ask for, the notice on your first visit only has an Accept button. If you do not want them, you can block cookies in your browser: the games still work, and the ranking, rooms and accounts do not.",
        ],
      },
      {
        heading: "What the server stores",
        blocks: [
          "The database holds the following, and nothing else about you.",
          {
            list: [
              "Your player: a random id, your display name, your nickname, the seed your avatar is drawn from (a short random text), a hash of your device's secret, your streak, and the dates the player was created and last active.",
              "Daily puzzles: for each daily puzzle you close, whether you solved it, revealed it or lost it, the game and, for a word game, its language, the date, the puzzle's number, difficulty and size, when you closed it, your time, the hints, mistakes and moves, the points, and the finished board. A daily counts once per player, and this is how your other devices know it is done and show the same result.",
              "Open dailies: for a daily you opened, when you first opened it and how many hints you have used on it, so its clock and its hints are the same on every device.",
              "Challenge rooms: the rooms you open or join, their rounds, when you started and finished each round and whether you solved it. Rooms are deleted about 36 hours after they are created.",
              "Passkeys, if you create an account: the passkey's identifier and public key, a usage counter, how the authenticator connects, whether the passkey is synced, a label with the browser and system it was made on, and when it was created and last used.",
              "Sessions: for each device signed in to your account, a random id, a hash of a secret and two dates.",
              "Reminders, if you turn them on: the address your browser's push service gave this device and the two keys that go with it, the language and the time zone to remind you in, when you turned them on, the date of the last reminder and a count of deliveries that failed. They are deleted when you turn reminders off, when you sign out, when the push service says the device is gone, or with your player.",
            ],
          },
          "A passkey's private key never leaves your device or your password manager. The site never sees your fingerprint, your face or your PIN: your device checks those by itself.",
          "Your display name, nickname, avatar, scores, streak and results in rooms are public. They appear in the rankings and to the other players of a room.",
        ],
      },
      {
        heading: "What is not collected",
        blocks: [
          {
            list: [
              "No email address, real name, phone number, address, payment data or precise location.",
              "No advertising or analytics cookies, no third-party trackers and no browser fingerprinting.",
              "Your IP address and your browser's identification are not stored in the site's database.",
            ],
          },
        ],
      },
      {
        heading: "Service providers",
        blocks: [
          {
            list: [
              "Vercel hosts the site. Like any host, it processes your IP address and your browser's identification to deliver the pages, and keeps request logs for a limited time. It also tells the site which country a request comes from. The site uses that once, to pick a language on your first visit, and does not store it.",
              "Neon hosts the database, in the United States.",
              "If you use a passkey, your password manager or device (Google, Apple, Microsoft, a security key and so on) handles it under its own terms. The site receives no personal data from it.",
              "If you turn on reminders, your browser's push service (Google, Mozilla, Microsoft or Apple) delivers them. The server hands it a message encrypted for your device, which the push service cannot read: one line saying your streak ends today.",
            ],
          },
          "Fonts and avatars are served or drawn by the site itself. No page loads content from another company's servers.",
        ],
      },
      {
        heading: "Why this data is used",
        blocks: [
          "The data is used to provide what you ask for: keeping your progress, showing you in a ranking, running a race in a room, signing you in. A small part serves the legitimate interest of keeping the site working and its rankings fair. These are the legal bases under Brazil's LGPD and the EU's GDPR.",
        ],
      },
      {
        heading: "How long it is kept",
        blocks: [
          {
            list: [
              "On your device: until you clear your browser's data.",
              "Challenge rooms: about 36 hours.",
              "Unused passkey challenges: deleted when the next one is created, 10 minutes or more after they were made.",
              "The record of a daily you opened, and the finished board of a daily you closed: about two days. After that the result stays and the board does not.",
              "A session: until you sign out on that device, until you sign out the other devices from one of them, or 180 days after you last used it.",
              "Your player, scores and passkeys: until you delete your player.",
            ],
          },
        ],
      },
      {
        heading: "Your choices and rights",
        blocks: [
          {
            list: [
              "See and change your display name, nickname and avatar on the Profile page.",
              "Delete your player and everything the server stores about it on the Profile page. It is immediate and permanent, and no copy is kept.",
              "Sign out of a device, or remove a passkey, on the Profile page.",
              "Turn reminders on or off in the settings, and withdraw the permission in your browser at any time.",
              "Clear what is on your device with your browser's own settings.",
            ],
          },
          "You may also ask for access to your data, a correction or its deletion through the contact below. Data protection laws such as the LGPD and the GDPR give you these rights, and the right to complain to your data protection authority.",
        ],
      },
      {
        heading: "Children",
        blocks: ["The site is made for a general audience and asks nobody for personal data. A parent or guardian who wants a child's player removed can delete it on the Profile page of the child's device, or ask through the contact below."],
      },
      {
        heading: "Changes",
        blocks: ["When what the site stores changes, this page changes with it, and the date at the top is updated."],
      },
      {
        heading: "Contact",
        blocks: ["The site is run by Bruno Silva. You can reach him through brunosilva.io, or open an issue in the project's repository on GitHub. Both are linked at the bottom of this page."],
      },
    ],
  },

  terms: {
    short: "Terms",
    title: "Terms of use",
    intro: ["Minigames (play.brunosilva.io) is a free site of daily puzzles, made and run by Bruno Silva as a personal project. By using it you agree to the terms below. They are short on purpose."],
    sections: [
      {
        heading: "The service",
        blocks: ["The site is free and is offered as it is. You can play every game without an account. The ranking, challenge rooms and accounts are extras that need the server, and they may be changed, limited or turned off."],
      },
      {
        heading: "Fair play",
        blocks: [
          "The rankings exist for fun. Times are reported by your own device, and the server cannot prove a solve was honest.",
          {
            list: [
              "Do not send scores with scripts or tools, and do not tamper with what your device reports.",
              "Do not disturb other players' rooms or try to act as another player.",
              "Do not overload the site with automated requests.",
            ],
          },
          "Scores and players that are clearly fake may be removed.",
        ],
      },
      {
        heading: "Names",
        blocks: [
          "Your display name and your nickname are public. Do not use them to pass as someone else, to insult or harass anyone, or for anything illegal. A name that breaks this rule may be changed or removed, with its player if need be.",
          "A nickname belongs to whoever takes it first. It is not reserved after you change it or delete your player.",
        ],
      },
      {
        heading: "Accounts",
        blocks: [
          "An account is a player with a passkey. You are responsible for the device, password manager or security key that holds it.",
          "The site keeps no email address and no password, so it has no way to recover an account for you. If you lose every passkey and every signed-in device, the account is lost. Adding a second passkey avoids that.",
        ],
      },
      {
        heading: "Your data",
        blocks: ["The privacy policy says what is stored and how to delete it. You can delete your player at any time on the Profile page."],
      },
      {
        heading: "Availability",
        blocks: ["This is a personal project with no service guarantee. The site may be unavailable, lose data, or end. Rankings may be reset. Keep nothing here that you cannot afford to lose."],
      },
      {
        heading: "Liability",
        blocks: ["To the extent the law allows, the site is provided without warranties of any kind, and its maintainer is not liable for damages that come from using it or from not being able to use it."],
      },
      {
        heading: "Source code",
        blocks: ["The site's code is public on GitHub under the MIT licence. The word lists and the chess pieces come from other projects under their own licences, listed in the repository."],
      },
      {
        heading: "Changes and governing law",
        blocks: ["These terms may change. The date at the top says when they last did, and using the site after a change means you accept it. The terms are governed by the laws of Brazil, where the maintainer lives."],
      },
      {
        heading: "Contact",
        blocks: ["Questions about these terms can be sent through brunosilva.io or as an issue in the project's repository on GitHub."],
      },
    ],
  },
};
