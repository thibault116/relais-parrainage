export const followCountsSQL = `(SELECT COUNT(*) FROM follows f WHERE f.followed_id=p.user_id) AS follower_count, (SELECT COUNT(*) FROM follows f WHERE f.follower_id=p.user_id) AS following_count`;
