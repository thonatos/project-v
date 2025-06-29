import React from 'react';
import { useSetAtom } from 'jotai';
import { CircleDollarSign } from 'lucide-react';
import { Checkout, CheckoutButton, CheckoutStatus } from '@coinbase/onchainkit/checkout';
import { createChargeAtom } from '~/store/chargeAtom';

interface PostSponsorProps {
  postId?: string;
}

export const PostSponsor: React.FC<PostSponsorProps> = ({ postId }) => {
  const createCharge = useSetAtom(createChargeAtom);

  const chargeHandler = async () => {
    const { data, error } = await createCharge(postId || '');

    if (error) {
      console.error('Error creating charge:', error);
      return '';
    }

    return data?.chargeId;
  };

  if (!postId) {
    return null;
  }

  return (
    <Checkout className="gap-0 mt-0 max-w-32" chargeHandler={chargeHandler}>
      <CheckoutButton
        className="border border-gray-200 rounded-md bg-primary text-white cursor-pointer p-1 mt-0"
        icon={<CircleDollarSign className="h-[1rem] w-[1rem]" />}
        text="Sponsor Post"
        coinbaseBranded
      />
      <CheckoutStatus />
    </Checkout>
  );
};

export default PostSponsor;
