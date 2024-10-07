import React from "react";
import type { ComponentType, PropsWithChildren } from 'react';

export interface IProvider<T> {
  Component: ComponentType<PropsWithChildren<T>>;
  props?: Omit<T, "children">;
}

export type IProviders = Array<IProvider<any>>;

export function createProvider<T>(Component: ComponentType<PropsWithChildren<T>>, props?: Omit<T, "children">): IProvider<T> {
  return { Component, props };
}

export function composeProviders(providers: IProviders): ComponentType<PropsWithChildren> {
  const ProviderComponent: React.FC<PropsWithChildren> = ({
    children,
  }) => {
    const initialJSX = <>{children}</>;

    return providers.reduceRight<JSX.Element>(
      (prevJSX, { Component: CurrentProvider, props = {} }) => {
        return <CurrentProvider {...props}>{prevJSX}</CurrentProvider>;
      },
      initialJSX
    );
  };

  return ProviderComponent;
}
