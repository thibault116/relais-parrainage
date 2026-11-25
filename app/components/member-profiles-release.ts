"use client";
import {featureAvailable} from '@/lib/feature-release';
import {useOwnerPreview} from './owner-preview';
export function useMemberProfiles(){const owner=useOwnerPreview();return featureAvailable('memberProfiles',false)||owner;}
