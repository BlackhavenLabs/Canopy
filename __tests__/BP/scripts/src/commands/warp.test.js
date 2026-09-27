import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameMode } from '@minecraft/server';

vi.mock('@minecraft/server', async (importOriginal) => {
    const original = await importOriginal();
    return {
        ...original,
        system: {
            ...original.system,
            run: vi.fn(callback => callback())
        }
    };
});

vi.mock('../../../../../Canopy[BP]/scripts/src/classes/Warps', () => ({
    default: {
        add: vi.fn(),
        remove: vi.fn(),
        teleport: vi.fn(),
        has: vi.fn(),
        isEmpty: vi.fn(),
        getNames: vi.fn()
    }
}));

import { Rules } from '../../../../../Canopy[BP]/scripts/lib/canopy/Canopy';
import Warps from '../../../../../Canopy[BP]/scripts/src/classes/Warps';
import {
    warpCommand,
    warpsCommand
} from '../../../../../Canopy[BP]/scripts/src/commands/warp';

describe('warp native command migration', () => {
    let player;
    let origin;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Rules, 'getNativeValue').mockReturnValue(true);

        player = {
            location: { x: 1, y: 2, z: 3 },
            dimension: { id: 'minecraft:overworld' },
            getGameMode: vi.fn(() => GameMode.Creative),
            sendMessage: vi.fn()
        };

        origin = {
            getSource: vi.fn(() => player)
        };
    });

    it('registers warp, w, and warps natively', () => {
        expect(warpCommand.customCommand.name).toBe('canopy:warp');
        expect(warpCommand.customCommand.aliases).toEqual(['canopy:w']);
        expect(warpCommand.customCommand.mandatoryParameters.map(parameter => parameter.name)).toEqual([
            'add/remove/name'
        ]);
        expect(warpCommand.customCommand.optionalParameters.map(parameter => parameter.name)).toEqual([
            'warp-name'
        ]);
        expect(warpsCommand.customCommand.name).toBe('canopy:warps');
    });

    it('preserves remove dispatch', () => {
        warpCommand.customCommand.callback(origin, 'remove', 'base');

        expect(Warps.remove).toHaveBeenCalledWith('base');
    });

    it('preserves add dispatch', () => {
        warpCommand.customCommand.callback(origin, 'add', 'base');

        expect(Warps.add).toHaveBeenCalledWith(
            'base',
            player.location,
            'minecraft:overworld'
        );
    });

    it('preserves teleport-by-name dispatch', () => {
        Warps.has.mockReturnValue(true);

        warpCommand.customCommand.callback(origin, 'base');

        expect(Warps.teleport).toHaveBeenCalledWith(player, 'base');
    });

    it('preserves warp Survival and Adventure blocking', () => {
        Rules.getNativeValue.mockReturnValue(false);

        player.getGameMode.mockReturnValue(GameMode.Survival);
        warpCommand.customCommand.callback(origin, 'base');

        expect(player.sendMessage).toHaveBeenCalledWith({
            translate: 'commands.generic.blocked.survival'
        });

        vi.clearAllMocks();
        Rules.getNativeValue.mockReturnValue(false);
        player.getGameMode.mockReturnValue(GameMode.Adventure);

        warpCommand.customCommand.callback(origin, 'base');

        expect(player.sendMessage).toHaveBeenCalledWith({
            translate: 'commands.generic.blocked.survival'
        });
    });

    it('preserves warps being blocked only in Survival', () => {
        Rules.getNativeValue.mockReturnValue(false);
        Warps.isEmpty.mockReturnValue(true);

        player.getGameMode.mockReturnValue(GameMode.Survival);
        warpsCommand.customCommand.callback(origin);

        expect(player.sendMessage).toHaveBeenCalledWith({
            translate: 'commands.generic.blocked.survival'
        });

        vi.clearAllMocks();
        Rules.getNativeValue.mockReturnValue(false);
        Warps.isEmpty.mockReturnValue(true);
        player.getGameMode.mockReturnValue(GameMode.Adventure);

        warpsCommand.customCommand.callback(origin);

        expect(player.sendMessage).toHaveBeenCalledWith({
            translate: 'commands.warp.list.empty'
        });
    });
});
