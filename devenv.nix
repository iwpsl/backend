{ pkgs, lib, config, inputs, ... }:

{
  devcontainer = {
    enable = true;
  };

  languages = {
    javascript = {
      enable = true;
      pnpm.enable = true;
    };
  };

  packages = with pkgs; [
    nodePackages.prisma
    mitmproxy
  ];

  git-hooks.hooks = {
    eslint = {
      enable = true;
      files = ".*";
    };
  };

  env = {
    PRISMA_SCHEMA_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/schema-engine";
    PRISMA_QUERY_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/query-engine";
    PRISMA_QUERY_ENGINE_LIBRARY = "${pkgs.prisma-engines}/lib/libquery_engine.node";
    PRISMA_FMT_BINARY = "${pkgs.prisma-engines}/bin/prisma-fmt";

    PUPPETEER_SKIP_DOWNLOAD = true;
    PUPPETEER_EXECUTABLE_PATH = "${pkgs.google-chrome}/bin/google-chrome-stable";
  };

  services = {
    postgres = {
      enable = true;
      listen_addresses = "127.0.0.1";
      initialDatabases = [{
        name = "database";
        user = "database";
        pass = "database";
      }];
      initialScript = ''
        ALTER ROLE database WITH CREATEDB;
      '';
    };

    redis = {
      enable = true;
    };
  };

  processes = {
    prisma-studio.exec = ''
      prisma studio --browser none
    '';

    express-prod.exec = ''
      pnpm build
      pnpm start
    '';

    worker-prod.exec = ''
      pnpm build
      pnpm start:worker
    '';

    mitmproxy.exec = ''
      mitmweb --mode reverse:http://localhost:3001 --listen-port 8080
    '';
  };
}
