# MARIE.js

MARIE.js is an implementation of a simulator for a 'Machine Architecture that is Really Intuitive and Easy'
from [The Essentials of Computer Organization and Architecture](https://books.google.com.au/books/about/The_Essentials_of_Computer_Organization.html?id=3kQoAwAAQBAJ&redir_esc=y) (Linda Null, Julia Lobur) in JavaScript.

**[Try the simulator](https://marie.js.org/)**

It is used within the unit [FIT1047 - Introduction to computer systems, networks and security](http://www.monash.edu/pubs/handbooks/units/FIT1047.html) at [Monash University](https://monash.edu).

## Development

First, install dependencies with

```sh
npm ci
```

Then start the development server with

```sh
npm run dev
```

The test suite can be run with

```sh
npm run test
```

THe formatter and linter can be run with

```sh
npm run format
npm run check
```

## Building

To build for production, run

```sh
npm run build
```

## License

MARIE.js is open-source software distributed under the [MIT License](https://opensource.org/license/mit).

See the [LICENSE](LICENSE) file for details.
