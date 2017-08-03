{ test ? false, production ? true }:

with import <nixpkgs> {};

let
  lib = rec {
    chrome-extension = haxePackages.buildHaxeLib {
      libname = "chrome-extension";
      version = "54.0.0";
      sha256 = "07979gyjqx2gv4sqnmqybsvbmy69vds9nxi4z2b0jvpwjpj566m5";
      meta.description = "Google chrome extension type definitions";
    };

    tink_core = haxePackages.buildHaxeLib {
      libname = "tink_core";
      version = "1.14.3";
      sha256 = "02m2jjm1328xzjz1ky8yd141fzd5cc23n1y7011d9sv7x20vyx4r";
      meta.description = "Tinkerbell Core";
    };

    tink_priority = haxePackages.buildHaxeLib {
      libname = "tink_priority";
      version = "0.1.3";
      sha256 = "0xlfcw4xn6rhnfazrfr3l8657l346f855fsjkhb0r7dqq8jv98q2";
      meta.description = "Tinkerbell Priotization";
    };

    tink_macro = haxePackages.buildHaxeLib {
      libname = "tink_macro";
      version = "0.14.0";
      sha256 = "1zp0bcd4wkxj100259vds7rz453rbj2a2bi5s7jx5ljfanhq8f8l";
      meta.description = "The macro toolkit ;)";
      propagatedBuildInputs = [ tink_core ];
    };

    ansi = haxePackages.buildHaxeLib {
      libname = "ansi";
      version = "1.0.0";
      sha256 = "0dx656r45jk8z3zw3dbpn79hbkaynvlzjh7kqz34zgmni27c8qyw";
      meta.description = "Haxe utility for working with ANSI escape sequences";
    };

    tink_streams = haxePackages.buildHaxeLib {
      libname = "tink_streams";
      version = "0.2.1";
      sha256 = "152ji27k97631bx9g3yxdw6k6hyahwldj8939kf7vz5p67v0pxrp";
      meta.description = "Streams from the future. With lasers, of course ... whoaaaaa!!!!";
      propagatedBuildInputs = [ tink_core ];
    };

    tink_testrunner = haxePackages.buildHaxeLib {
      libname = "tink_testrunner";
      version = "0.6.1";
      sha256 = "0krml5hv8kf8crqanasp5v1nzfr4hhkkccx20lslq13zqrz9xi30";
      meta.description = "";
      propagatedBuildInputs = [ ansi tink_macro tink_streams ];
    };

    tink_syntaxhub = haxePackages.buildHaxeLib {
      libname = "tink_syntaxhub";
      version = "0.3.6";
      sha256 = "0j09vppciqr32pa4bi3ykq3lg1c949vhxp0v1rc3np938ghziyig";
      meta.description = "Hub for plugging in language extensions.";
      propagatedBuildInputs = [ tink_priority tink_macro ];
    };

    tink_unittest = haxePackages.buildHaxeLib {
      libname = "tink_unittest";
      version = "0.5.3";
      sha256 = "18l2r3sh5c3bk9hk06ff36nbhf7s55qx4lgpk9fvaaxpxd4h1ix6";
      meta.description = "";
      propagatedBuildInputs = [ tink_testrunner tink_syntaxhub ];
    };
  };

  testFlags = if test
    then ["-D run-tests"]
    else [];

  productionFlags = if production
    then ["--no-traces"]
    else ["-debug" "-D source-map-content"];

  flags = builtins.concatStringsSep " " (testFlags ++ productionFlags);

  build = path: name: ''
    haxe -main '${path}.${name}' \
      -cp 'src' \
      -lib chrome-extension \
      -js 'build/js/${name}.js' \
      -dce full \
      -D js-flatten \
      -D analyzer \
      -D source-map \
      ${flags}
  '';
in
  stdenv.mkDerivation rec {
    src = ./.;

    name = "tab-organizer-5.0.0-beta";

    buildInputs = [
      haxe
      lib.chrome-extension
      /*lib.tink_core
      lib.tink_unittest*/
    ];

    phases = [ "unpackPhase" "buildPhase" "installPhase" ];

    buildPhase = ''
      ${build "server" "Server"}
      ${build "panel" "Panel"}
      ${build "options" "Options"}
    '';

    installPhase = ''
      mkdir "$out"

      cp --recursive "build/." "$out"
    '';
  }
