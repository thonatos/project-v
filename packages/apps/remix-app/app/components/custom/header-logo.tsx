import React from 'react';
import styled from '@emotion/styled';

const Wrapper = styled.section`
  display: flex;
  align-items: baseline;
`;

const Title = styled.h1`
  color: #829a82 !important;
  margin: 0;
  padding: 0;
  font-size: 16px;
`;

const Description = styled.p`
  color: #8264ff !important;
  opacity: 0.55;
  margin: 0 0 0 0.4em;
`;

export const Logo: React.FC<Props> = ({ title, description }) => (
  <Wrapper>
    <Title>{title}</Title>
    {description && <Description>{description}</Description>}
  </Wrapper>
);

export default Logo;

interface Props {
  title: string;
  description?: string;
}
