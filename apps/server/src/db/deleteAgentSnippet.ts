  delete(id: string): boolean {
    const run = this.db.transaction(() => {
      if (!this.get(id)) return false;
      this.db.pragma('foreign_keys = ON');
      const exec = (sql: string, ...args: unknown[]) => {
        try {
          this.db.prepare(sql).run(...args);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (/no such table/i.test(msg)) return;
          throw e;
        }
      };
      let routineIds: Array<{ id: string }> = [];
      try {
        routineIds = this.db.prepare(`SELECT id FROM routines WHERE agent_id=?`).all(id) as Array<{ id: string }>;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/no such table/i.test(msg)) throw e;
      }
      for (const r of routineIds) {
        exec(`DELETE FROM routine_runs WHERE routine_id=?`, r.id);
      }
      exec(`DELETE FROM routines WHERE agent_id=?`, id);
      exec(`DELETE FROM messages WHERE agent_id=?`, id);
      exec(`DELETE FROM memory WHERE agent_id=?`, id);
      exec(`DELETE FROM agent_inbox WHERE from_agent_id=? OR to_agent_id=?`, id, id);
      exec(`DELETE FROM channel_members WHERE agent_id=?`, id);
      exec(`UPDATE channel_messages SET from_agent_id=NULL WHERE from_agent_id=?`, id);
      exec(`DELETE FROM tasks WHERE agent_id=?`, id);
      exec(`DELETE FROM approvals WHERE agent_id=?`, id);
      exec(`DELETE FROM shares WHERE agent_id=?`, id);
      exec(`UPDATE uploads SET agent_id=NULL WHERE agent_id=?`, id);
      try {
        const lonely = this.db
          .prepare(
            `SELECT c.id FROM channels c LEFT JOIN channel_members m ON m.channel_id=c.id GROUP BY c.id HAVING COUNT(m.agent_id) < 2`
          )
          .all() as Array<{ id: string }>;
        for (const row of lonely) {
          exec(`DELETE FROM channel_messages WHERE channel_id=?`, row.id);
          exec(`DELETE FROM channel_members WHERE channel_id=?`, row.id);
          exec(`DELETE FROM channels WHERE id=?`, row.id);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/no such table/i.test(msg)) throw e;
      }
      return this.db.prepare(`DELETE FROM agents WHERE id=?`).run(id).changes > 0;
    });
    return run();
  }
