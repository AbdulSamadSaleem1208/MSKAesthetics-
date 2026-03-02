import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Channel, City, Discount, Platform, Product } from '../lib/db';

export type ConfigData = {
  products: Product[];
  channels: Channel[];
  cities: City[];
  platforms: Platform[];
  discounts: Discount[];
  loading: boolean;
  refresh: () => Promise<void>;
};

export function useConfigData(): ConfigData {
  const [products, setProducts] = useState<Product[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const [p, ch, ci, pl, di] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('channels').select('*').order('name'),
      supabase.from('cities').select('*').order('name'),
      supabase.from('platforms').select('*').order('name'),
      supabase.from('discounts').select('*').order('pct'),
    ]);

    if (!p.error && p.data) setProducts(p.data as Product[]);
    if (!ch.error && ch.data) setChannels(ch.data as Channel[]);
    if (!ci.error && ci.data) setCities(ci.data as City[]);
    if (!pl.error && pl.data) setPlatforms(pl.data as Platform[]);
    if (!di.error && di.data) setDiscounts(di.data as Discount[]);

    setLoading(false);
  }

  useEffect(() => {
    void refresh();

    const channel = supabase
      .channel('cfg-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'channels' },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cities' },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platforms' },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'discounts' },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { products, channels, cities, platforms, discounts, loading, refresh };
}
