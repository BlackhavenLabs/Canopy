import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomCommandStatus } from '@minecraft/server';

vi.mock('../../../../../Canopy[BP]/scripts/include/utils', () => ({
    stringifyLocation: vi.fn(location => `${location.x}, ${location.y}, ${location.z}`),
    getRaycastResults: vi.fn(() => ({
        blockRayResult: undefined,
        entityRayResult: []
    })),
    getClosestTarget: vi.fn(),
    calcDistance: vi.fn((locationOne, locationTwo, includeY) => {
        const x = locationTwo.x - locationOne.x;
        const y = locationTwo.y - locationOne.y;
        const z = locationTwo.z - locationOne.z;

        if (includeY)
            return Math.sqrt(x ** 2 + y ** 2 + z ** 2);

        return Math.sqrt(x ** 2 + z ** 2);
    })
}));

import {
    DISTANCE_ACTIONS,
    DISTANCE_CONNECTORS,
    distanceCommand
} from '../../../../../Canopy[BP]/scripts/src/commands/distance';

describe('DistanceCommand registration', () => {
    it('registers the native distance command and d alias', () => {
        expect(distanceCommand.customCommand.name).toBe('canopy:distance');
        expect(distanceCommand.customCommand.aliases).toEqual(['canopy:d']);
    });

    it('registers target, from, and to as distance actions', () => {
        expect(DISTANCE_ACTIONS).toEqual([
            'target',
            'from',
            'to'
        ]);
    });

    it('registers to as the location connector', () => {
        expect(DISTANCE_CONNECTORS).toEqual(['to']);
    });

    it('uses action followed by location, connector, and destination', () => {
        expect(distanceCommand.customCommand.mandatoryParameters.map(parameter => parameter.name)).toEqual([
            'canopy:distanceAction'
        ]);

        expect(distanceCommand.customCommand.optionalParameters.map(parameter => parameter.name)).toEqual([
            'location',
            'canopy:distanceConnector',
            'location'
        ]);
    });
});

describe('DistanceCommand dispatch', () => {
    let player;
    let origin;

    beforeEach(() => {
        vi.clearAllMocks();

        distanceCommand.savedLocation = undefined;

        player = {
            name: 'TestPlayer',
            location: {
                x: 10,
                y: 20,
                z: 30
            },
            getHeadLocation: vi.fn(() => ({
                x: 10,
                y: 21.62,
                z: 30
            }))
        };

        origin = {
            getSource: vi.fn(() => player),
            sendMessage: vi.fn()
        };
    });

    it('saves the current player location with from', () => {
        const result = distanceCommand.distanceCommand(origin, 'from');

        expect(result).toEqual({
            status: CustomCommandStatus.Success
        });

        expect(distanceCommand.savedLocation).toEqual({
            x: 10,
            y: 20,
            z: 30
        });

        expect(origin.sendMessage).toHaveBeenCalledWith({
            translate: 'commands.distance.from.success',
            with: ['10, 20, 30']
        });
    });

    it('saves a supplied location with from', () => {
        const location = {
            x: 1,
            y: 2,
            z: 3
        };

        distanceCommand.distanceCommand(origin, 'from', location);

        expect(distanceCommand.savedLocation).toEqual(location);
    });

    it('reports when to is used without a saved location', () => {
        distanceCommand.distanceCommand(origin, 'to');

        expect(origin.sendMessage).toHaveBeenCalledWith({
            translate: 'commands.distance.to.fail.nosave',
            with: ['/canopy:']
        });
    });

    it('measures from the saved location to the player when destination is omitted', () => {
        distanceCommand.savedLocation = {
            x: 0,
            y: 0,
            z: 0
        };

        distanceCommand.distanceCommand(origin, 'to');

        const message = origin.sendMessage.mock.calls[0][0];

        expect(message.rawtext[0].text).toContain('0, 0, 0');
        expect(message.rawtext[0].text).toContain('10, 20, 30');
    });

    it('measures from the saved location to a supplied destination', () => {
        distanceCommand.savedLocation = {
            x: 0,
            y: 0,
            z: 0
        };

        const destination = {
            x: 3,
            y: 4,
            z: 0
        };

        distanceCommand.distanceCommand(
            origin,
            'to',
            destination
        );

        const message = origin.sendMessage.mock.calls[0][0];

        expect(message.rawtext[0].text).toContain('0, 0, 0');
        expect(message.rawtext[0].text).toContain('3, 4, 0');
    });

    it('measures directly from a supplied location to the player', () => {
        const from = {
            x: 1,
            y: 2,
            z: 3
        };

        distanceCommand.distanceCommand(
            origin,
            'from',
            from,
            'to'
        );

        const message = origin.sendMessage.mock.calls[0][0];

        expect(message.rawtext[0].text).toContain('1, 2, 3');
        expect(message.rawtext[0].text).toContain('10, 20, 30');
    });

    it('measures directly between two supplied locations', () => {
        const from = {
            x: 1,
            y: 2,
            z: 3
        };

        const to = {
            x: 4,
            y: 6,
            z: 3
        };

        distanceCommand.distanceCommand(
            origin,
            'from',
            from,
            'to',
            to
        );

        const message = origin.sendMessage.mock.calls[0][0];

        expect(message.rawtext[0].text).toContain('1, 2, 3');
        expect(message.rawtext[0].text).toContain('4, 6, 3');
    });

    it('reports when target finds nothing', () => {
        distanceCommand.distanceCommand(
            origin,
            'target'
        );

        expect(origin.sendMessage).toHaveBeenCalledWith({
            translate: 'commands.distance.target.notfound'
        });
    });

    it('rejects parameters after target', () => {
        const result = distanceCommand.distanceCommand(
            origin,
            'target',
            { x: 1, y: 2, z: 3 }
        );

        expect(result).toEqual({
            status: CustomCommandStatus.Failure
        });

        expect(origin.sendMessage).toHaveBeenCalledWith({
            translate: 'commands.generic.usage',
            with: ['/canopy:distance <target|from|to> [location] [to] [location]']
        });
    });
});
