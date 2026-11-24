import { useCallback, useState, useEffect } from 'react';
import { subscribeRealtime } from '../realtime';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api';
export default function useWeekSchedule(endpoint, weekStart) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(()=>subscribeRealtime(()=>setReloadKey(k=>k+1)),[]);

  useFocusEffect(useCallback(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .get(endpoint, { params: { weekStart } })
      .then((res) => {
        if (alive) setData(res.data);
      })
      .catch((e) => {
        if (alive) setError(e);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [endpoint, weekStart, reloadKey]));

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { data, loading, error, reload };
}
