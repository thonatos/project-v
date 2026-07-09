FROM mcr.microsoft.com/devcontainers/javascript-node:24

ARG ZSH_CONFIG="/root/.zshrc"

RUN \
  apt-get update \
  && apt-get install -y git-extras vim \
  && corepack enable \
  && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
  && echo "source /root/.cargo/env" >> $ZSH_CONFIG  

USER root
