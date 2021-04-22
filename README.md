# JSXaal

JSXaal is a JavaScript-based viewer for XAAL, the
[eXtensible Algorithm Animation Language](http://xaal.org).

## Demo

There is a working demo running at
http://demo.villekaravirta.com/jsxaal/doc/example.html .

## Basic installation

1. Clone this git repository.

   `git clone git@github.com:atilante/jsxaal.git`   

2. To run JSXaal locally, you need a minimal web server that can host files
   over HTTP. One easy way is to install [Python](https://www.python.org).

3. Run Python web server at the JSXaal source code directory.
   `python -m http.server 8000 --bind 127.0.0.1`

4. Open the following web page in your browser:
   http://localhost:8000/

5. Navigate to `doc/example.html`


## Development

Building the JavaScript requires [Ruby](https://www.ruby-lang.org/en/) and
[rake-compiler](https://github.com/rake-compiler/rake-compiler/).

In theory, the following should do the thing:

`rake compile`

## Authors

The software is made by Ville Karavirta in 2009.
This README file is made by Artturi Tilanterä in 2021.
