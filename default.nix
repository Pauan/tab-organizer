{ test ? false }:
#{ stdenv, haxe, buildHaxeLib }:

with import <nixpkgs> {};

let
  debug = if test then "-D run-tests" else "";
in
  stdenv.mkDerivation {
    name = "tab-organizer-5.0.0-beta";

    src = ./.;

    buildInputs = [
      haxe

      (haxePackages.buildHaxeLib {
        libname = "chrome-extension";
        version = "54.0.0";
        sha256 = "07979gyjqx2gv4sqnmqybsvbmy69vds9nxi4z2b0jvpwjpj566m5";
        meta.description = "Google chrome extension type definitions";
      })
    ];

    phases = [ "unpackPhase" "buildPhase" "installPhase" ];

    buildPhase = ''
      haxe -main Server -cp src/Server -lib chrome-extension -js build/js/server.js -debug -dce full ${debug}
    '';

    installPhase = ''
      mkdir "$out"

      cp --recursive "build/." "$out"
    '';
  }
