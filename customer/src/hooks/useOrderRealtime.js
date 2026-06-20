import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client (Ensure environment variables are loaded)
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const useOrderRealtime = (orderId) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId) return;

    // Fetch initial order state snapshot
    const fetchInitialOrder = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (fetchError) throw fetchError;
        setOrder(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialOrder();

    // Subscribe to real-time row-level changes for the active order
    const orderSubscription = supabase
      .channel(`public:orders:id=eq.${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          // Hot swap old state with real-time broadcasted payload
          setOrder(payload.new);
        }
      )
      .subscribe();

    // Clean up pipeline channel subscription on component unmount
    return () => {
      supabase.removeChannel(orderSubscription);
    };
  }, [orderId]);

  return { order, loading, error };
};
