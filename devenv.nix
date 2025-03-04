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
}
